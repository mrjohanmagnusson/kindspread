/// <reference lib="webworker" />

const CACHE_NAME = 'kindspread-v1';

// Install event - cache essential files
self.addEventListener('install', (event) => {
	console.log('[SW] Installing...');
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(['/', '/manifest.json']);
		})
	);
	self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	console.log('[SW] Activating...');
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	self.clients.claim();
});

// Push event - show notification when push is received
self.addEventListener('push', (event) => {
	console.log('[SW] Push received:', event);

	const defaultData = {
		title: "Today's Kindness Mission",
		body: 'Open the app to see your daily mission!',
		icon: '/icons/icon-192.svg',
		badge: '/icons/icon-192.svg',
		tag: 'kindness-mission',
		data: {
			url: '/'
		}
	};

	let data = defaultData;

	if (event.data) {
		try {
			const payload = event.data.json();
			console.log('[SW] Push payload:', payload);
			data = { ...defaultData, ...payload };
		} catch {
			console.log('[SW] Push text:', event.data.text());
			data.body = event.data.text() || data.body;
		}
	}

	console.log('[SW] Showing notification:', data);

	const options = {
		body: data.body,
		icon: data.icon || '/icons/icon-192.svg',
		badge: data.badge || '/icons/icon-192.svg',
		tag: data.tag || 'kindness-mission',
		vibrate: [100, 50, 100],
		data: data.data || { url: '/' },
		requireInteraction: false
	};

	event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event - open the app
self.addEventListener('notificationclick', (event) => {
	console.log('[SW] Notification clicked');
	event.notification.close();

	const urlToOpen = event.notification.data?.url || '/';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// If a window is already open, focus it
			for (const client of clientList) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					return client.focus();
				}
			}
			// Otherwise, open a new window
			if (clients.openWindow) {
				return clients.openWindow(urlToOpen);
			}
		})
	);
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
	event.respondWith(
		fetch(event.request).catch(() => {
			return caches.match(event.request);
		})
	);
});

