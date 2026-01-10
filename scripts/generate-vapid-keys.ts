/**
 * Script to generate VAPID keys for Web Push notifications
 * Run with: npx tsx scripts/generate-vapid-keys.ts
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

	// Export public key in raw format (for client)
	const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
	const publicKeyBase64Url = arrayBufferToBase64Url(publicKeyRaw);

	// Export private key in PKCS8 format (for server)
	const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
	const privateKeyBase64Url = arrayBufferToBase64Url(privateKeyPkcs8);

	console.log('\n🔐 VAPID Keys Generated Successfully!\n');
	console.log('Add these to your Cloudflare Worker secrets:\n');
	console.log('----------------------------------------');
	console.log('VAPID_PUBLIC_KEY=');
	console.log(publicKeyBase64Url);
	console.log('\nVAPID_PRIVATE_KEY=');
	console.log(privateKeyBase64Url);
	console.log('\nVAPID_SUBJECT=mailto:your-email@example.com');
	console.log('----------------------------------------\n');
	console.log('To set these secrets in Cloudflare, run:');
	console.log('  wrangler secret put VAPID_PUBLIC_KEY');
	console.log('  wrangler secret put VAPID_PRIVATE_KEY');
	console.log('  wrangler secret put VAPID_SUBJECT\n');
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

