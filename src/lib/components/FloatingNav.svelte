<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		isPushSupported,
		getNotificationPermission,
		subscribeToPush,
		unsubscribeFromPush,
		isSubscribedToPush
	} from '$lib/push';
	import {
		initDarkMode,
		getDarkMode,
		toggleDarkMode as toggleDarkModeStore
	} from '$lib/stores/dark-mode';
	import { House, BellRing, BellOff, BadgeQuestionMark } from '@jis3r/icons';
	import EarthIcon from '$lib/components/icons/EarthIcon.svelte';

	// Dark mode state - use shared store
	let darkMode = $state(true);

	// Push notification state
	let pushSupported = $state(false);
	let notificationPermission = $state<NotificationPermission | 'unsupported'>('default');
	let isSubscribed = $state(false);
	let isToggling = $state(false);

	$effect(() => {
		if (browser) {
			initDarkMode();
			darkMode = getDarkMode();

			// Listen for dark mode changes
			const handleDarkModeChange = (e: CustomEvent<boolean>) => {
				darkMode = e.detail;
			};
			window.addEventListener('darkModeChange', handleDarkModeChange as EventListener);
			return () =>
				window.removeEventListener('darkModeChange', handleDarkModeChange as EventListener);
		}
	});

	onMount(() => {
		if (browser) {
			pushSupported = isPushSupported();
			notificationPermission = getNotificationPermission();
			if (pushSupported && notificationPermission === 'granted') {
				isSubscribedToPush().then((subscribed) => {
					isSubscribed = subscribed;
				});
			}
		}
	});

	function toggleDarkMode() {
		toggleDarkModeStore();
		darkMode = getDarkMode();
	}

	async function toggleNotifications() {
		if (!pushSupported || isToggling) return;

		isToggling = true;
		try {
			if (isSubscribed) {
				await unsubscribeFromPush();
				isSubscribed = false;
			} else {
				const subscription = await subscribeToPush();
				isSubscribed = subscription !== null;
				notificationPermission = getNotificationPermission();
			}
		} finally {
			isToggling = false;
		}
	}

	// Get current path for active state
	const currentPath = $derived($page.url.pathname as string);
</script>

<nav
	class="fixed bottom-4 left-1/2 z-500 flex -translate-x-1/2 flex-row items-center gap-1 rounded-2xl p-2 shadow-lg backdrop-blur-sm transition-colors duration-300 md:top-4 md:right-4 md:bottom-auto md:left-auto md:translate-x-0 md:flex-col {darkMode
		? 'border border-gray-700 bg-gray-800/90'
		: 'border border-gray-200 bg-white/90'}"
>
	<!-- Home -->
	<a
		href={resolveRoute('/')}
		class="rounded-xl p-2.5 h-10 transition-all duration-200 {currentPath === '/'
			? darkMode
				? 'bg-gray-700 text-rose-400'
				: 'bg-rose-100 text-rose-600'
			: darkMode
				? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
				: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
		title="Home"
	>
		<House size={20} />
	</a>

	<!-- World Map -->
	<a
		href={resolveRoute('/map')}
		class="rounded-xl p-2.5 h-10 transition-all duration-200 {currentPath === '/map'
			? darkMode
				? 'bg-gray-700 text-emerald-400'
				: 'bg-emerald-100 text-emerald-600'
			: darkMode
				? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
				: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
		title="World Map"
	>
		<EarthIcon class="h-5 w-5" />
	</a>

	<!-- Info -->
	<a
		href="/info"
		class="rounded-xl p-2.5 h-10 transition-all duration-200 {currentPath.startsWith('/info')
			? darkMode
				? 'bg-gray-700 text-sky-400'
				: 'bg-sky-100 text-sky-600'
			: darkMode
				? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
				: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
		title="Info"
	>
		<BadgeQuestionMark size={20} />
	</a>

	<!-- Separator -->
	<div
		class="mx-1 h-6 w-px md:mx-0 md:my-1 md:h-px md:w-6 {darkMode ? 'bg-gray-600' : 'bg-gray-300'}"
	></div>

	<!-- Notifications Toggle -->
	{#if pushSupported}
		<button
			onclick={toggleNotifications}
			disabled={isToggling || notificationPermission === 'denied'}
			class="cursor-pointer h-10 rounded-xl p-2.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 {isSubscribed
				? darkMode
					? 'text-amber-400 hover:bg-gray-700'
					: 'text-amber-500 hover:bg-gray-100'
				: darkMode
					? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
					: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
			title={notificationPermission === 'denied'
				? 'Notifications blocked in browser settings'
				: isSubscribed
					? 'Turn off daily reminders'
					: 'Turn on daily reminders'}
		>
			{#if isToggling}
				<svg class="h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					></path>
				</svg>
			{:else if isSubscribed}
				<!-- Bell with ring (active) -->
				<BellRing size={20} />
			{:else if notificationPermission === 'denied'}
				<!-- Bell with slash (blocked) -->
				<BellOff size={20} />
			{:else}
				<!-- Bell outline (inactive) -->
				<BellOff size={20} />
			{/if}
		</button>
	{/if}

	<!-- Dark Mode Toggle -->
	<button
		onclick={toggleDarkMode}
		class="cursor-pointer h-10 rounded-xl p-2.5 transition-all duration-200 {darkMode
			? 'text-yellow-400 hover:bg-gray-700'
			: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
		title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
	>
		{#if darkMode}
			<!-- Sun icon -->
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
				></path>
			</svg>
		{:else}
			<!-- Moon icon -->
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
				></path>
			</svg>
		{/if}
	</button>
</nav>
