/**
 * Web Push utilities compatible with Cloudflare Workers
 * Implements RFC 8291 (Message Encryption for Web Push) and VAPID
 */

/**
 * Convert base64url to Uint8Array
 */
function base64UrlToUint8Array(base64url: string): Uint8Array {
	const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
	const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * Convert Uint8Array to base64url
 */
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
	const base64 = btoa(String.fromCharCode(...uint8Array));
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert ArrayBuffer to base64url
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
	return uint8ArrayToBase64Url(new Uint8Array(buffer));
}

/**
 * Create VAPID JWT token using JWK format for key import
 */
async function createVapidJwt(
	audience: string,
	subject: string,
	publicKey: string,
	privateKey: string,
	expiration: number
): Promise<string> {
	const header = { typ: 'JWT', alg: 'ES256' };
	const payload = {
		aud: audience,
		exp: expiration,
		sub: subject
	};

	const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
	const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
	const unsignedToken = `${headerB64}.${payloadB64}`;

	// Get x and y coordinates from the public key (65 bytes: 0x04 + 32 bytes x + 32 bytes y)
	const publicKeyBytes = base64UrlToUint8Array(publicKey);
	const x = uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33));
	const y = uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65));

	// Import the private key using JWK format
	const jwk: JsonWebKey = {
		kty: 'EC',
		crv: 'P-256',
		x: x,
		y: y,
		d: privateKey, // Private key is already base64url encoded (32 bytes)
		ext: true
	};

	const cryptoKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

	// Sign the token
	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		cryptoKey,
		new TextEncoder().encode(unsignedToken)
	);

	const signatureB64 = arrayBufferToBase64Url(signature);

	return `${unsignedToken}.${signatureB64}`;
}

/**
 * Create VAPID authorization header
 */
export async function createVapidAuthHeader(
	endpoint: string,
	subject: string,
	publicKey: string,
	privateKey: string
): Promise<{ Authorization: string; 'Crypto-Key': string }> {
	const url = new URL(endpoint);
	const audience = `${url.protocol}//${url.host}`;
	const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours

	const jwt = await createVapidJwt(audience, subject, publicKey, privateKey, expiration);

	return {
		Authorization: `vapid t=${jwt}, k=${publicKey}`,
		'Crypto-Key': `p256ecdsa=${publicKey}`
	};
}

/**
 * Encrypt push payload using aes128gcm content encoding (RFC 8291)
 */
export async function encryptPayload(
	payload: string,
	p256dhKey: string,
	authSecret: string
): Promise<Uint8Array> {
	const payloadBytes = new TextEncoder().encode(payload);

	// Decode subscriber's public key and auth secret
	const subscriberPublicKey = base64UrlToUint8Array(p256dhKey);
	const subscriberAuth = base64UrlToUint8Array(authSecret);

	// Generate ephemeral ECDH key pair for encryption
	const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);

	// Export the public key for the header
	const localPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
	const localPublicKeyBytes = new Uint8Array(localPublicKey);

	// Import subscriber's public key
	const importedSubscriberKey = await crypto.subtle.importKey(
		'raw',
		subscriberPublicKey.buffer as ArrayBuffer,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);

	// Derive shared secret via ECDH
	const sharedSecret = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: importedSubscriberKey },
		keyPair.privateKey,
		256
	);

	// Generate random salt (16 bytes)
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// Build info for HKDF - auth info
	const authInfo = concatUint8Arrays([new TextEncoder().encode('WebPush: info\x00'), subscriberPublicKey, localPublicKeyBytes]);

	// Derive IKM from shared secret using auth
	const sharedSecretKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);

	// Create proper ArrayBuffer from subscriberAuth (slice creates a new ArrayBuffer)
	const authSalt = subscriberAuth.slice().buffer;

	const ikm = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt: authSalt, info: authInfo.slice().buffer },
		sharedSecretKey,
		256
	);

	// Derive CEK and nonce from IKM
	const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

	const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\x00');
	const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\x00');

	const cek = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: cekInfo }, ikmKey, 128);

	const nonce = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: nonceInfo }, ikmKey, 96);

	// Import CEK for AES-GCM encryption
	const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);

	// Add padding delimiter (0x02 = final record)
	const paddedPayload = new Uint8Array(payloadBytes.length + 1);
	paddedPayload.set(payloadBytes);
	paddedPayload[payloadBytes.length] = 0x02;

	// Encrypt
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload);

	// Build the aes128gcm header: salt (16) + rs (4) + idlen (1) + keyid (65) + ciphertext
	const recordSize = 4096;
	const rs = new Uint8Array(4);
	new DataView(rs.buffer).setUint32(0, recordSize, false);

	const header = concatUint8Arrays([salt, rs, new Uint8Array([localPublicKeyBytes.length]), localPublicKeyBytes]);

	return concatUint8Arrays([header, new Uint8Array(encrypted)]);
}

/**
 * Concatenate multiple Uint8Arrays
 */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}
