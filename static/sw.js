/// <reference lib="webworker" />

const CACHE_NAME = 'kindspread-v1';

// Install event - cache essential files
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(['/', '/manifest.json']);
		})
	);
	self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
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
	const defaultData = {
		title: "Today's Kindness Mission",
		body: 'Open the app to see your daily mission!',
		icon: '/icons/icon-192.png',
		badge: '/icons/icon-192.png',
		tag: 'kindness-mission',
		data: {
			url: '/'
		}
	};

	let data = defaultData;

	if (event.data) {
		try {
			const payload = event.data.json();
			data = { ...defaultData, ...payload };
		} catch {
			data.body = event.data.text() || data.body;
		}
	}

	const options = {
		body: data.body,
		icon: data.icon || '/icons/icon-192.png',
		badge: data.badge || '/icons/icon-192.png',
		tag: data.tag || 'kindness-mission',
		vibrate: [100, 50, 100],
		data: data.data || { url: '/' },
		actions: [
			{
				action: 'open',
				title: 'View Mission'
			},
			{
				action: 'dismiss',
				title: 'Later'
			}
		],
		requireInteraction: true
	};

	event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event - open the app
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	if (event.action === 'dismiss') {
		return;
	}

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

