<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		isPushSupported,
		getNotificationPermission,
		subscribeToPush,
		unsubscribeFromPush,
		isSubscribedToPush
	} from '$lib/push';

	// Sample missions - later this could come from a database
	const missions = [
		// Appreciation & Gratitude
		"Tell someone you know that you are proud of them",
		"Tell someone you know why you are thankful for them",
		"Write a thank you note to someone who helped you recently",
		"Send a voice message telling someone how much they mean to you",
		"Thank a service worker (barista, cashier, bus driver) by name",
		"Tell your parents or guardians one thing you appreciate about them",
		"Compliment someone on their character, not just their appearance",

		// Reaching Out
		"Send a kind message to someone you haven't talked to in a while",
		"Check in on a friend who might be going through a tough time",
		"Reach out to an old teacher or mentor and share how they impacted you",
		"Send an encouraging text to someone who's working on a goal",
		"Call a family member you haven't spoken to recently",
		"Reply to someone's social media post with a genuine, thoughtful comment",

		// Acts of Service
		"Offer to help a colleague or friend with something",
		"Hold the door open for the next 5 people you see",
		"Let someone go ahead of you in line",
		"Offer to take a photo for tourists or a group trying to take a selfie",
		"Help someone carry their groceries or bags",
		"Offer your seat to someone on public transport",
		"Pick up litter you see on the street",
		"Return a shopping cart for someone",

		// Giving
		"Buy a coffee for the person behind you in line",
		"Donate something you no longer need to charity",
		"Leave a generous tip for excellent service",
		"Give a book you loved to someone who might enjoy it",
		"Share your umbrella with a stranger in the rain",
		"Donate to a cause you care about, any amount counts",
		"Leave a positive note in a library book",

		// Kindness at Work/School
		"Praise a coworker's effort in front of others",
		"Bring snacks to share with your team or class",
		"Offer to help a new person learn the ropes",
		"Give credit to someone who deserves recognition",
		"Write a positive review for a local business you love",
		"Recommend someone for an opportunity",

		// Digital Kindness
		"Share something positive on social media",
		"Leave an encouraging comment on a creator's content",
		"Unfollow negative accounts and follow uplifting ones instead",
		"Send a supportive DM to someone going through something publicly",
		"Write a genuine LinkedIn recommendation for a colleague",
		"Leave a 5-star review for a product or service you enjoyed",

		// Strangers
		"Give a genuine compliment to a stranger",
		"Smile and say hello to 10 people today",
		"Pay for someone's parking meter",
		"Leave encouraging sticky notes in public places",
		"Compliment a parent on how well-behaved their child is",
		"Tell a store manager about an employee who gave great service",

		// Self & Mindfulness
		"Forgive someone who wronged you, even if just in your heart",
		"Practice patience today - don't honk, don't rush, don't complain",
		"Give someone the benefit of the doubt today",
		"Listen fully to someone without planning your response",
		"Put your phone away and be fully present with someone",
		"Apologize to someone you may have hurt, even if unintentionally",

		// Community
		"Introduce two people who might benefit from knowing each other",
		"Offer directions or help to someone who looks lost",
		"Support a local small business today",
		"Attend a community event and meet someone new",
		"Volunteer an hour of your time to help others",
		"Babysit or pet-sit for a friend who needs a break"
	];

	// Get today's mission based on the date (simple deterministic selection)
	const today = new Date();
	const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

	// Allow shuffling to a different mission
	let currentMissionIndex = $state(dayOfYear % missions.length);
	let hasShuffled = $state(false);

	// Derived mission text
	const todaysMission = $derived(missions[currentMissionIndex]);

	// Format today's date nicely
	const formattedDate = today.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});

	let missionCompleted = $state(false);
	let isCompletingMission = $state(false);
	let completionError = $state<string | null>(null);

	// Location state
	let userLocation = $state<{ latitude: number; longitude: number; city?: string; country?: string } | null>(null);

	// Generate anonymous ID for duplicate prevention (stored in localStorage)
	function getAnonymousId(): string {
		if (!browser) return '';
		let id = localStorage.getItem('kindspread_anon_id');
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem('kindspread_anon_id', id);
		}
		return id;
	}

	// Request user's location
	async function requestLocation(): Promise<{ latitude: number; longitude: number } | null> {
		if (!browser || !navigator.geolocation) return null;

		return new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					resolve({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude
					});
				},
				() => resolve(null),
				{ timeout: 10000, enableHighAccuracy: false }
			);
		});
	}

	// Reverse geocode to get city/country (using free Nominatim API)
	async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; country?: string }> {
		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
				{ headers: { 'User-Agent': 'KindSpread/1.0' } }
			);
			const data = (await response.json()) as { address?: { city?: string; town?: string; village?: string; country?: string } };
			return {
				city: data.address?.city || data.address?.town || data.address?.village,
				country: data.address?.country
			};
		} catch {
			return {};
		}
	}

	// Shuffle to get a different random mission
	function shuffleMission() {
		let newIndex: number;
		do {
			newIndex = Math.floor(Math.random() * missions.length);
		} while (newIndex === currentMissionIndex && missions.length > 1);

		currentMissionIndex = newIndex;
		hasShuffled = true;
	}

	// Complete mission and save to database
	async function completeMission() {
		isCompletingMission = true;
		completionError = null;

		try {
			// Request location if not already obtained
			if (!userLocation) {
				const coords = await requestLocation();
				if (coords) {
					const geo = await reverseGeocode(coords.latitude, coords.longitude);
					userLocation = { ...coords, ...geo };
				}
			}

			// If we have location, save to database
			if (userLocation) {
				const response = await fetch('/api/completions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						mission_text: todaysMission,
						latitude: userLocation.latitude,
						longitude: userLocation.longitude,
						city: userLocation.city,
						country: userLocation.country,
						anonymous_id: getAnonymousId()
					})
				});

				const data = (await response.json()) as { error?: string; duplicate?: boolean };
				if (!response.ok && !data.duplicate) {
					console.error('Failed to save completion:', data.error);
				}
			}

			missionCompleted = true;
			if (browser) {
				localStorage.setItem('lastCompletedDate', today.toISOString().split('T')[0]);
			}
		} catch (error) {
			console.error('Error completing mission:', error);
			completionError = 'Failed to save. Your kindness still counts! 💝';
			missionCompleted = true; // Still mark as complete locally
		} finally {
			isCompletingMission = false;
		}
	}

	// Check if mission was already completed today
	$effect(() => {
		if (browser) {
			const lastCompleted = localStorage.getItem('lastCompletedDate');
			const todayStr = today.toISOString().split('T')[0];
			if (lastCompleted === todayStr) {
				missionCompleted = true;
			}
		}
	});

	// Dark mode support
	let darkMode = $state(false);

	// Initialize dark mode from localStorage or system preference
	$effect(() => {
		if (browser) {
			const stored = localStorage.getItem('darkMode');
			if (stored !== null) {
				darkMode = stored === 'true';
			} else {
				darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
		}
	});

	// Persist dark mode preference
	$effect(() => {
		if (browser) {
			localStorage.setItem('darkMode', String(darkMode));
		}
	});

	function toggleDarkMode() {
		darkMode = !darkMode;
	}

	// Push notification state
	let pushSupported = $state(false);
	let notificationPermission = $state<NotificationPermission | 'unsupported'>('default');
	let isSubscribed = $state(false);
	let isSubscribing = $state(false);

	onMount(async () => {
		pushSupported = isPushSupported();
		notificationPermission = getNotificationPermission();
		if (pushSupported && notificationPermission === 'granted') {
			isSubscribed = await isSubscribedToPush();
		}
	});

	async function handleSubscribe() {
		isSubscribing = true;
		try {
			const subscription = await subscribeToPush();
			isSubscribed = subscription !== null;
			notificationPermission = getNotificationPermission();
		} finally {
			isSubscribing = false;
		}
	}

	async function handleUnsubscribe() {
		isSubscribing = true;
		try {
			await unsubscribeFromPush();
			isSubscribed = false;
		} finally {
			isSubscribing = false;
		}
	}

	// Test notification (dev only)
	let isSendingTest = $state(false);
	let testResult = $state<string | null>(null);

	async function sendTestNotification() {
		isSendingTest = true;
		testResult = null;
		try {
			const response = await fetch('/api/push/test', { method: 'POST' });
			const data = (await response.json()) as { error?: string };
			testResult = response.ok
				? '✅ Test notification sent!'
				: `❌ ${data.error || 'Failed to send'}`;
		} catch (error) {
			testResult = `❌ Error: ${error}`;
		} finally {
			isSendingTest = false;
			// Clear message after 5 seconds
			setTimeout(() => testResult = null, 5000);
		}
	}
</script>

<div class="min-h-screen transition-colors duration-300" class:bg-linear-to-br={!darkMode} class:from-rose-50={!darkMode} class:via-amber-50={!darkMode} class:to-emerald-50={!darkMode} class:bg-gray-900={darkMode}>
	<!-- Dark Mode Toggle -->
	<button
		onclick={toggleDarkMode}
		class="fixed top-4 right-4 p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 cursor-pointer {darkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'}"
		aria-label="Toggle dark mode"
	>
		{#if darkMode}
			<!-- Sun icon -->
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
			</svg>
		{:else}
			<!-- Moon icon -->
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
			</svg>
		{/if}
	</button>

	<!-- Header -->
	<header class="py-8 text-center">
		<h1 class="text-5xl font-bold bg-linear-to-r from-rose-500 via-amber-500 to-emerald-500 bg-clip-text text-transparent">
			KindSpread
		</h1>
		<p class="mt-2 text-lg {darkMode ? 'text-gray-400' : 'text-gray-600'}">Spreading kindness is free 💝</p>
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-2xl px-4 py-8">
		<!-- Date -->
		<p class="text-center text-sm mb-6 {darkMode ? 'text-gray-500' : 'text-gray-500'}">{formattedDate}</p>

		<!-- Mission Card -->
		<div class="rounded-3xl shadow-xl p-8 border transition-colors duration-300 {darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}">
			<div class="text-center mb-6">
				<span class="inline-block px-4 py-1 rounded-full text-sm font-medium {darkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-700'}">
					Today's Mission
				</span>
			</div>

			<h2 class="text-2xl font-semibold text-center leading-relaxed mb-4 {darkMode ? 'text-gray-100' : 'text-gray-800'}">
				"{todaysMission}"
			</h2>

			<!-- Shuffle Button -->
			{#if !missionCompleted}
				<div class="text-center mb-8">
					<button
						onclick={shuffleMission}
						class="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-all cursor-pointer {darkMode ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}"
						title="Can't do this one? Get a different mission"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
						</svg>
						{hasShuffled ? 'Try another' : "Can't do this one?"}
					</button>
				</div>
			{/if}

			<!-- Complete Button -->
			<div class="text-center">
				{#if missionCompleted}
					<div class="space-y-4">
						<div class="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium {darkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
							</svg>
							Mission Completed!
						</div>
						<p class="{darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm">You've spread kindness today! Come back tomorrow for a new mission.</p>
						{#if completionError}
							<p class="text-amber-500 text-sm">{completionError}</p>
						{/if}
						<a href="/map" class="inline-block mt-2 text-lg underline {darkMode ? 'text-amber-400' : 'text-amber-500'} hover:opacity-80">
							See kindness around the world
						</a>
					</div>
				{:else}
					<button
						onclick={completeMission}
						disabled={isCompletingMission}
						class="px-8 py-3 bg-linear-to-r from-rose-500 to-amber-500 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
					>
						{#if isCompletingMission}
							Saving... 💝
						{:else}
							Mark as Complete ✨
						{/if}
					</button>
					<p class="mt-3 text-xs {darkMode ? 'text-gray-500' : 'text-gray-400'}">
						📍 Your kindness will appear on the world map
					</p>
				{/if}
			</div>
		</div>

		<!-- Notification Subscription Card -->
		{#if pushSupported}
			<div class="mt-6 rounded-2xl p-6 border transition-colors duration-300 {darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white/80 border-gray-100'}">
				<div class="flex items-center justify-between gap-4">
					<div class="flex items-center gap-3">
						<div class="p-2 rounded-full {darkMode ? 'bg-rose-900/50' : 'bg-rose-100'}">
							<svg class="w-5 h-5 {darkMode ? 'text-rose-400' : 'text-rose-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
							</svg>
						</div>
						<div>
							<p class="font-medium {darkMode ? 'text-gray-200' : 'text-gray-800'}">Daily Reminders</p>
							<p class="text-sm {darkMode ? 'text-gray-400' : 'text-gray-500'}">
								{#if isSubscribed}
									You'll receive daily mission reminders
								{:else if notificationPermission === 'denied'}
									Notifications are blocked in browser settings
								{:else}
									Get notified each morning with your mission
								{/if}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						{#if notificationPermission === 'denied'}
							<span class="text-sm {darkMode ? 'text-gray-500' : 'text-gray-400'}">Blocked</span>
						{:else if isSubscribed}
							<button
								onclick={sendTestNotification}
								disabled={isSendingTest}
								class="px-3 py-2 rounded-full text-sm font-medium transition-all cursor-pointer disabled:opacity-50 {darkMode ? 'bg-amber-900/50 text-amber-400 hover:bg-amber-900/70' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}"
								title="Send a test notification"
							>
								{isSendingTest ? '...' : '🧪'}
							</button>
							<button
								onclick={handleUnsubscribe}
								disabled={isSubscribing}
								class="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer disabled:opacity-50 {darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
							>
								{isSubscribing ? 'Updating...' : 'Turn Off'}
							</button>
						{:else}
							<button
								onclick={handleSubscribe}
								disabled={isSubscribing}
								class="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer disabled:opacity-50 bg-linear-to-r from-rose-500 to-amber-500 text-white hover:shadow-lg"
							>
								{isSubscribing ? 'Enabling...' : 'Enable'}
							</button>
						{/if}
					</div>
				</div>
				{#if testResult}
					<p class="mt-3 text-sm text-center {darkMode ? 'text-gray-400' : 'text-gray-500'}">{testResult}</p>
				{/if}
			</div>
		{/if}

		<!-- Stats/Info Section -->
		<div class="mt-8 grid grid-cols-3 gap-4">
			<div class="backdrop-blur rounded-2xl p-6 text-center border transition-colors duration-300 {darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white/60 border-white/80'}">
				<p class="text-3xl font-bold text-rose-500">∞</p>
				<p class="text-sm mt-1 {darkMode ? 'text-gray-400' : 'text-gray-600'}">Acts of Kindness Possible</p>
			</div>
			<div class="backdrop-blur rounded-2xl p-6 text-center border transition-colors duration-300 {darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white/60 border-white/80'}">
				<p class="text-3xl font-bold text-emerald-500">$0</p>
				<p class="text-sm mt-1 {darkMode ? 'text-gray-400' : 'text-gray-600'}">Cost to Be Kind</p>
			</div>
			<a href="/map" class="backdrop-blur rounded-2xl p-6 text-center border transition-colors duration-300 hover:scale-105 {darkMode ? 'bg-gray-800/60 border-gray-700 hover:bg-gray-800' : 'bg-white/60 border-white/80 hover:bg-white'}">
				<p class="text-3xl">🌍</p>
				<p class="text-sm mt-1 {darkMode ? 'text-gray-400' : 'text-gray-600'}">World Map</p>
			</a>
		</div>

		<!-- Motivational Footer -->
		<p class="text-center mt-12 text-sm {darkMode ? 'text-gray-500' : 'text-gray-500'}">
			"No act of kindness, no matter how small, is ever wasted." — Aesop
		</p>
	</main>

	<!-- Site Footer -->
	<footer class="py-6 text-center {darkMode ? 'text-gray-600' : 'text-gray-400'}">
		<p class="text-xs">
			Built with ☕ Swedish snus and passion for Svelte by <a href="https://m7n.dev" target="_blank" rel="noopener noreferrer" class="underline hover:text-rose-500 transition-colors">m7n.dev</a>
		</p>
	</footer>
</div>

