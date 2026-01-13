/**
 * Post-build script to add scheduled handler to the SvelteKit Cloudflare worker
 * This script runs after vite build and injects the scheduled export
 *
 * Missions are read from src/lib/missions.json - the single source of truth
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const workerPath = join(__dirname, '..', '.svelte-kit', 'cloudflare', '_worker.js');
const missionsPath = join(__dirname, '..', 'src', 'lib', 'missions.json');

// Read the generated worker
let workerCode = readFileSync(workerPath, 'utf-8');

// Read missions from the single source of truth
const missions = JSON.parse(readFileSync(missionsPath, 'utf-8'));

// Build the scheduled handler code with missions embedded
const scheduledHandler = `
// === INJECTED SCHEDULED HANDLER START ===

/**
 * Kindness missions - loaded from src/lib/missions.json at build time
 */
var missions = ${JSON.stringify(missions, null, 2)};

function getMissionForDay(date) {
  if (!date) date = new Date();
  var dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  var index = dayOfYear % missions.length;
  return { mission: missions[index], index: index };
}

function base64UrlToUint8Array(base64url) {
  var padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  var base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  var rawData = atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(uint8Array) {
  var base64 = btoa(String.fromCharCode.apply(null, uint8Array));
  return base64.replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
}

function arrayBufferToBase64Url(buffer) {
  return uint8ArrayToBase64Url(new Uint8Array(buffer));
}

async function createVapidJwt(audience, subject, publicKey, privateKey, expiration) {
  var header = { typ: "JWT", alg: "ES256" };
  var payload = { aud: audience, exp: expiration, sub: subject };

  var headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  var payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  var unsignedToken = headerB64 + "." + payloadB64;

  var publicKeyBytes = base64UrlToUint8Array(publicKey);
  var x = uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33));
  var y = uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65));

  var jwk = { kty: "EC", crv: "P-256", x: x, y: y, d: privateKey, ext: true };

  var cryptoKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );

  var signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, cryptoKey, new TextEncoder().encode(unsignedToken)
  );

  return unsignedToken + "." + arrayBufferToBase64Url(signature);
}

async function createVapidAuthHeader(endpoint, subject, publicKey, privateKey) {
  var url = new URL(endpoint);
  var audience = url.protocol + "//" + url.host;
  var expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  var jwt = await createVapidJwt(audience, subject, publicKey, privateKey, expiration);

  return {
    Authorization: "vapid t=" + jwt + ", k=" + publicKey,
    "Crypto-Key": "p256ecdsa=" + publicKey
  };
}

function concatUint8Arrays(arrays) {
  var totalLength = arrays.reduce(function(sum, arr) { return sum + arr.length; }, 0);
  var result = new Uint8Array(totalLength);
  var offset = 0;
  for (var i = 0; i < arrays.length; i++) {
    result.set(arrays[i], offset);
    offset += arrays[i].length;
  }
  return result;
}

async function encryptPayload(payload, p256dhKey, authSecret) {
  var payloadBytes = new TextEncoder().encode(payload);
  var subscriberPublicKey = base64UrlToUint8Array(p256dhKey);
  var subscriberAuth = base64UrlToUint8Array(authSecret);

  var keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  var localPublicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  var localPublicKeyBytes = new Uint8Array(localPublicKey);

  var importedSubscriberKey = await crypto.subtle.importKey(
    "raw", subscriberPublicKey.buffer, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  var sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: importedSubscriberKey }, keyPair.privateKey, 256
  );

  var salt = crypto.getRandomValues(new Uint8Array(16));

  var authInfoBytes = new TextEncoder().encode("WebPush: info\\0");
  var authInfo = concatUint8Arrays([authInfoBytes, subscriberPublicKey, localPublicKeyBytes]);

  var sharedSecretKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  var authSalt = subscriberAuth.slice().buffer;

  var ikm = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSalt, info: authInfo.slice().buffer },
    sharedSecretKey, 256
  );

  var ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  var cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\\0");
  var nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\\0");

  var cek = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt, info: cekInfo }, ikmKey, 128);
  var nonce = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt, info: nonceInfo }, ikmKey, 96);

  var aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);

  var paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 0x02;

  var encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload);

  var recordSize = 4096;
  var rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, recordSize, false);

  var header = concatUint8Arrays([salt, rs, new Uint8Array([localPublicKeyBytes.length]), localPublicKeyBytes]);

  return concatUint8Arrays([header, new Uint8Array(encrypted)]);
}

async function scheduled(event, env, ctx) {
  console.log("Cron triggered at:", new Date(event.scheduledTime).toISOString());

  var db = env.DB;
  if (!db) {
    console.error("Database not available");
    return;
  }

  var missionData = getMissionForDay();
  var payload = JSON.stringify({
    title: "Today's Kindness Mission",
    body: missionData.mission,
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: "kindness-mission",
    data: { url: "/" }
  });

  var queryResult = await db
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE active = 1")
    .all();
  var results = queryResult.results;

  if (!results || results.length === 0) {
    console.log("No active subscriptions found");
    return;
  }

  console.log("Sending notifications to " + results.length + " subscribers");

  var vapidSubject = env.VAPID_SUBJECT || "mailto:hello@kindspread.app";
  var expiredEndpoints = [];

  await Promise.all(
    results.map(async function(subscription) {
      try {
        var encrypted = await encryptPayload(payload, subscription.p256dh, subscription.auth);
        var vapidHeaders = await createVapidAuthHeader(
          subscription.endpoint, vapidSubject, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY
        );

        var response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            Authorization: vapidHeaders.Authorization,
            "Crypto-Key": vapidHeaders["Crypto-Key"],
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            "Content-Length": encrypted.byteLength.toString(),
            TTL: "86400"
          },
          body: encrypted
        });

        if (response.status === 410 || response.status === 404) {
          expiredEndpoints.push(subscription.endpoint);
        }
      } catch (error) {
        console.error("Push failed:", error);
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    console.log("Marking " + expiredEndpoints.length + " expired subscriptions as inactive");
    for (var i = 0; i < expiredEndpoints.length; i++) {
      await db.prepare("UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?").bind(expiredEndpoints[i]).run();
    }
  }

  console.log("Push notifications sent successfully");
}

// === INJECTED SCHEDULED HANDLER END ===
`;

// Append the scheduled handler
workerCode = workerCode + '\n' + scheduledHandler + '\nexport { scheduled };\n';

// Write the modified worker
writeFileSync(workerPath, workerCode);

console.log('✅ Scheduled handler injected with ' + missions.length + ' missions');
