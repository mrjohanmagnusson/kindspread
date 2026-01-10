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
 * Create VAPID JWT token
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

	// Import the private key for signing
	const privateKeyBytes = base64UrlToUint8Array(privateKey);
	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		privateKeyBytes.buffer as ArrayBuffer,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);

	// Sign the token
	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		cryptoKey,
		new TextEncoder().encode(unsignedToken)
	);

	// Convert signature from DER to raw format if needed
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
 * Encrypt push payload using aes128gcm content encoding
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

	// Generate ephemeral ECDH key pair
	const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits'
	]);

	// Export the public key for the header
	const publicKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey);

	// Import subscriber's public key
	const importedSubscriberKey = await crypto.subtle.importKey(
		'raw',
		subscriberPublicKey.buffer as ArrayBuffer,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);

	// Derive shared secret
	const sharedSecret = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: importedSubscriberKey },
		keyPair.privateKey,
		256
	);

	// Generate salt
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// Derive keys using HKDF
	const sharedSecretKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
		'deriveBits'
	]);

	// PRK = HKDF-Extract(auth_secret, ecdh_secret)
	const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
	const prkBits = await crypto.subtle.deriveBits(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: subscriberAuth.buffer as ArrayBuffer,
			info: authInfo
		},
		sharedSecretKey,
		256
	);

	const prkKey = await crypto.subtle.importKey('raw', prkBits, 'HKDF', false, ['deriveBits']);

	// Create context for key derivation
	const keyInfoContext = new Uint8Array([
		...new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
		...new Uint8Array([0, 65]), // key length prefix
		...new Uint8Array(publicKeyBytes),
		...new Uint8Array([0, 65]), // subscriber key length prefix
		...subscriberPublicKey
	]);

	const nonceInfoContext = new Uint8Array([
		...new TextEncoder().encode('Content-Encoding: nonce\0'),
		...new Uint8Array([0, 65]),
		...new Uint8Array(publicKeyBytes),
		...new Uint8Array([0, 65]),
		...subscriberPublicKey
	]);

	// Derive content encryption key and nonce
	const cekBits = await crypto.subtle.deriveBits(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: salt,
			info: keyInfoContext
		},
		prkKey,
		128
	);

	const nonceBits = await crypto.subtle.deriveBits(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: salt,
			info: nonceInfoContext
		},
		prkKey,
		96
	);

	// Import CEK for AES-GCM
	const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);

	// Pad the payload (add delimiter byte 0x02)
	const paddedPayload = new Uint8Array(payloadBytes.length + 1);
	paddedPayload.set(payloadBytes);
	paddedPayload[payloadBytes.length] = 0x02; // Delimiter

	// Encrypt
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: nonceBits },
		cek,
		paddedPayload
	);

	// Build the final message: salt (16) + rs (4) + idlen (1) + keyid (65) + encrypted content
	const recordSize = 4096;
	const rs = new Uint8Array(4);
	new DataView(rs.buffer).setUint32(0, recordSize, false);

	const result = new Uint8Array(
		16 + 4 + 1 + new Uint8Array(publicKeyBytes).length + new Uint8Array(encrypted).length
	);

	let offset = 0;
	result.set(salt, offset);
	offset += 16;
	result.set(rs, offset);
	offset += 4;
	result[offset] = new Uint8Array(publicKeyBytes).length;
	offset += 1;
	result.set(new Uint8Array(publicKeyBytes), offset);
	offset += new Uint8Array(publicKeyBytes).length;
	result.set(new Uint8Array(encrypted), offset);

	return result;
}

