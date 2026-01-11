<script lang="ts">
	import { browser } from '$app/environment';
	import { resolveRoute } from '$app/paths';
	import { missions, getMissionForDay, getRandomMission } from '$lib/missions';
	import { Heart, Infinity as InfinityIcon, Sparkles, MapPinCheck, RefreshCcw } from '@jis3r/icons';
	import EarthIcon from '$lib/components/icons/EarthIcon.svelte';

	// Get today's mission based on the date
	const today = new Date();
	const { index: initialIndex } = getMissionForDay(today);

	// Allow shuffling to a different mission
	let currentMissionIndex = $state(initialIndex);
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
	let userLocation = $state<{
		latitude: number;
		longitude: number;
		city?: string;
		country?: string;
	} | null>(null);

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
	async function reverseGeocode(
		lat: number,
		lng: number
	): Promise<{ city?: string; country?: string }> {
		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
				{ headers: { 'User-Agent': 'KindSpread/1.0' } }
			);
			const data = (await response.json()) as {
				address?: { city?: string; town?: string; village?: string; country?: string };
			};
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
		const { index } = getRandomMission(currentMissionIndex);
		currentMissionIndex = index;
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

	// Dark mode support - default to dark mode
	let darkMode = $state(true);

	// Initialize dark mode from localStorage (default to dark if not set)
	$effect(() => {
		if (browser) {
			const stored = localStorage.getItem('darkMode');
			if (stored !== null) {
				darkMode = stored === 'true';
			}
			// If not stored, keep default (true = dark mode)

			// Listen for dark mode changes from FloatingNav
			const handleDarkModeChange = (e: CustomEvent<boolean>) => {
				darkMode = e.detail;
			};
			window.addEventListener('darkModeChange', handleDarkModeChange as EventListener);
			return () =>
				window.removeEventListener('darkModeChange', handleDarkModeChange as EventListener);
		}
	});
</script>

<div
	class="min-h-screen transition-colors duration-300"
	class:bg-linear-to-br={!darkMode}
	class:from-rose-50={!darkMode}
	class:via-amber-50={!darkMode}
	class:to-emerald-50={!darkMode}
	class:bg-gray-900={darkMode}
>
	<!-- Header -->
	<header class="py-8 text-center">
		<h1
			class="inline-block bg-linear-to-r from-rose-500 via-amber-500 to-emerald-500 bg-clip-text text-5xl font-bold text-transparent"
		>
			KindSpread
		</h1>
		<p class="m-auto mt-2 max-w-[32ch] px-4 text-lg {darkMode ? 'text-gray-400' : 'text-gray-600'}">
			Help spreading kindness around the globe - it is free <Heart size={20} color="#f43f5e" />
		</p>
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-2xl px-4 py-8">
		<!-- Date -->
		<p class="mb-6 text-center text-sm {darkMode ? 'text-gray-500' : 'text-gray-500'}">
			{formattedDate}
		</p>

		<!-- Mission Card -->
		<div
			class="rounded-3xl border p-8 shadow-xl transition-colors duration-300 {darkMode
				? 'border-gray-700 bg-gray-800'
				: 'border-gray-100 bg-white'}"
		>
			<div class="mb-6 text-center">
				<span
					class="inline-block rounded-full px-4 py-1 text-sm font-medium {darkMode
						? 'bg-amber-900/50 text-amber-400'
						: 'bg-amber-100 text-amber-700'}"
				>
					Today's Mission
				</span>
			</div>

			<h2
				class="mb-4 text-center text-2xl leading-relaxed font-semibold {darkMode
					? 'text-gray-100'
					: 'text-gray-800'}"
			>
				"{todaysMission}"
			</h2>

			<!-- Shuffle Button -->
			{#if !missionCompleted}
				<div class="mb-8 text-center">
					<button
						onclick={shuffleMission}
						class="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm transition-all {darkMode
							? 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
							: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}"
						title="Can't do this one? Get a different mission"
					>
						<RefreshCcw size={16} />
						{hasShuffled ? 'Try another' : "Can't do this one?"}
					</button>
				</div>
			{/if}

			<!-- Complete Button -->
			<div class="flex flex-col items-center text-center">
				{#if missionCompleted}
					<div class="space-y-4">
						<div
							class="inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium {darkMode
								? 'bg-emerald-900/50 text-emerald-400'
								: 'bg-emerald-100 text-emerald-700'}"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								></path>
							</svg>
							Mission Completed!
						</div>
						<p class="{darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm">
							You've spread kindness today! Come back tomorrow for a new mission.
						</p>
						{#if completionError}
							<p class="text-sm text-amber-500">{completionError}</p>
						{/if}
						<a
							href={resolveRoute('/map')}
							class="mt-2 inline-block text-lg underline {darkMode
								? 'text-amber-400'
								: 'text-amber-500'} hover:opacity-80"
						>
							See kindness spread around the world
						</a>
					</div>
				{:else}
					<button
						onclick={completeMission}
						disabled={isCompletingMission}
						class="cursor-pointer rounded-full bg-linear-to-r from-rose-500 via-amber-500 to-emerald-500 px-8 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
					>
						<span class="inline-flex items-center gap-2">
							{#if isCompletingMission}
								Saving... <Heart size={16} color="white" class="inline" />
							{:else}
								Mark as Complete <Sparkles size={16} color="white" class="inline" />
							{/if}
						</span>
					</button>
					<p
						class="mt-3 inline-flex items-center gap-1 text-xs {darkMode
							? 'text-gray-500'
							: 'text-gray-400'}"
					>
						<MapPinCheck size={16} /> Your kindness will appear on the world map
					</p>
				{/if}
			</div>
		</div>

		<!-- Stats/Info Section -->
		<div class="mt-8 grid grid-cols-3 gap-4">
			<div
				class="rounded-2xl border p-6 text-center backdrop-blur transition-colors duration-300 {darkMode
					? 'border-gray-700 bg-gray-800/60'
					: 'border-white/80 bg-white/60'}"
			>
				<InfinityIcon size={40} color="#f43f5e" class="mx-auto" />
				<p class="mt-1 text-sm {darkMode ? 'text-gray-400' : 'text-gray-600'}">
					Acts of Kindness Possible
				</p>
			</div>
			<div
				class="rounded-2xl border p-6 text-center backdrop-blur transition-colors duration-300 {darkMode
					? 'border-gray-700 bg-gray-800/60'
					: 'border-white/80 bg-white/60'}"
			>
				<p class="text-3xl font-bold text-emerald-500">$0</p>
				<p class="mt-1 text-sm {darkMode ? 'text-gray-400' : 'text-gray-600'}">
					The cost of beeing kind to someone.
				</p>
			</div>
			<a
				href={resolveRoute('/map')}
				class="rounded-2xl border p-6 text-center backdrop-blur transition-colors duration-300 hover:scale-105 {darkMode
					? 'border-gray-700 bg-gray-800/60 hover:bg-gray-800'
					: 'border-white/80 bg-white/60 hover:bg-white'}"
			>
				<EarthIcon class="mx-auto h-10 w-10 text-emerald-500" />
				<p class="mt-1 text-sm {darkMode ? 'text-gray-400' : 'text-gray-600'}">
					Kindness spread around the world
				</p>
			</a>
		</div>

		<!-- Motivational Footer -->
		<p class="mt-12 text-center text-sm {darkMode ? 'text-gray-500' : 'text-gray-500'}">
			"No act of kindness, no matter how small, is ever wasted." — Aesop
		</p>
	</main>

	<!-- Site Footer -->
	<footer class="py-6 text-center {darkMode ? 'text-gray-600' : 'text-gray-400'}">
		<p class="text-xs">
			Built with coffey, snus and passion for Svelte by <a
				href="https://m7n.dev"
				target="_blank"
				rel="noopener noreferrer"
				class="underline transition-colors hover:text-purple-600">m7n.dev</a
			>
		</p>
	</footer>
</div>
