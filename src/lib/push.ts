import { browser } from '$app/environment';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
	if (!browser) return false;
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
	if (!browser || !('Notification' in window)) return 'unsupported';
	return Notification.permission;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (!browser || !('serviceWorker' in navigator)) return null;

	try {
		const registration = await navigator.serviceWorker.register('/sw.js', {
			scope: '/'
		});
		console.log('Service Worker registered:', registration.scope);
		return registration;
	} catch (error) {
		console.error('Service Worker registration failed:', error);
		return null;
	}
}

/**
 * Get existing service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
	if (!browser || !('serviceWorker' in navigator)) return null;

	try {
		return await navigator.serviceWorker.ready;
	} catch {
		return null;
	}
}

/**
 * Convert URL-safe base64 to Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
	try {
		// Request notification permission
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') {
			console.log('Notification permission denied');
			return null;
		}

		// Get service worker registration
		const registration = await getServiceWorkerRegistration();
		if (!registration) {
			console.error('No service worker registration');
			return null;
		}

		// Fetch VAPID public key from server
		const response = await fetch('/api/push/vapid-public-key');
		if (!response.ok) {
			console.error('Failed to fetch VAPID key');
			return null;
		}
		const data = (await response.json()) as { publicKey: string };
		const publicKey = data.publicKey;

		// Subscribe to push
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
		});

		// Send subscription to server
		const saveResponse = await fetch('/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(subscription.toJSON())
		});

		if (!saveResponse.ok) {
			console.error('Failed to save subscription');
			return null;
		}

		console.log('Push subscription successful');
		return subscription;
	} catch (error) {
		console.error('Error subscribing to push:', error);
		return null;
	}
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
	try {
		const registration = await getServiceWorkerRegistration();
		if (!registration) return false;

		const subscription = await registration.pushManager.getSubscription();
		if (!subscription) return true;

		// Unsubscribe locally
		await subscription.unsubscribe();

		// Remove from server
		await fetch('/api/push/subscribe', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint: subscription.endpoint })
		});

		console.log('Push unsubscription successful');
		return true;
	} catch (error) {
		console.error('Error unsubscribing from push:', error);
		return false;
	}
}

/**
 * Check if user is subscribed to push notifications
 */
export async function isSubscribedToPush(): Promise<boolean> {
	try {
		const registration = await getServiceWorkerRegistration();
		if (!registration) return false;

		const subscription = await registration.pushManager.getSubscription();
		return subscription !== null;
	} catch {
		return false;
	}
}
