/**
 * Script to generate VAPID keys for Web Push notifications
 * Run with: npx tsx scripts/generate-vapid-keys.ts
 *
 * These keys are in the correct format for Web Push:
 * - Public key: 65 bytes, uncompressed EC point (base64url)
 * - Private key: 32 bytes, raw EC private key (base64url)
 */

async function generateVapidKeys() {
	// Generate ECDSA P-256 key pair
	const keyPair = await crypto.subtle.generateKey(
		{
			name: 'ECDSA',
			namedCurve: 'P-256'
		},
		true,
		['sign', 'verify']
	);

	// Export public key in raw/uncompressed format (65 bytes)
	const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
	const publicKeyBase64Url = arrayBufferToBase64Url(publicKeyRaw);

	// Export private key in JWK format to get the raw 'd' value
	const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
	const privateKeyBase64Url = privateKeyJwk.d!; // 'd' is already base64url encoded

	console.log('\n🔐 VAPID Keys Generated Successfully!\n');
	console.log('Add these to your .dev.vars file for local development:');
	console.log('And use `wrangler secret put` for production.\n');
	console.log('----------------------------------------');
	console.log(`VAPID_PUBLIC_KEY=${publicKeyBase64Url}`);
	console.log(`VAPID_PRIVATE_KEY=${privateKeyBase64Url}`);
	console.log('VAPID_SUBJECT=mailto:your-email@example.com');
	console.log('----------------------------------------\n');
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	const base64 = btoa(binary);
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

generateVapidKeys().catch(console.error);
