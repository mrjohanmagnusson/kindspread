<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { resolveRoute } from '$app/paths';
	import { HandHeart } from '@jis3r/icons';
	import { initDarkMode, getDarkMode } from '$lib/stores/dark-mode';
	import { isMissionCompletedToday } from '$lib/stores/mission-state';

	interface Completion {
		id: number;
		mission_text: string;
		latitude: number;
		longitude: number;
		city: string | null;
		country: string | null;
		completed_at: string;
	}

	let completions = $state<Completion[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let mapContainer: HTMLDivElement;
	let map: L.Map | null = null;
	let hoursFilter = $state(168);

	// Dark mode - use shared store
	let darkMode = $state(true);

	// Check if today's mission is completed
	let missionCompleted = $state(false);

	onMount(async () => {
		if (browser) {
			initDarkMode();
			darkMode = getDarkMode();

			// Check if mission was already completed today
			missionCompleted = isMissionCompletedToday();

			// Listen for dark mode changes from FloatingNav
			const handleDarkModeChange = (e: CustomEvent<boolean>) => {
				darkMode = e.detail;
			};
			window.addEventListener('darkModeChange', handleDarkModeChange as EventListener);
		}

		await loadCompletions();
		await initMap();
	});

	async function loadCompletions() {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/completions?hours=${hoursFilter}&limit=500`);
			const data = (await response.json()) as { completions?: Completion[]; error?: string };
			if (response.ok) {
				completions = data.completions || [];
			} else {
				error = data.error || 'Failed to load completions';
			}
		} catch {
			error = 'Failed to fetch data';
		} finally {
			loading = false;
		}
	}

	async function initMap() {
		if (!browser || !mapContainer) return;

		// Dynamically import Leaflet
		const L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');

		// Create map centered on world view
		map = L.map(mapContainer).setView([20, 0], 2);

		// Add tile layer (using OpenStreetMap)
		const tileUrl = darkMode
			? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
			: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

		L.tileLayer(tileUrl, {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			maxZoom: 18
		}).addTo(map);

		// Add markers for completions
		updateMarkers(L);
	}

	function updateMarkers(L: typeof import('leaflet')) {
		if (!map) return;

		// Clear existing markers
		map.eachLayer((layer) => {
			if (layer instanceof L.Marker) {
				map!.removeLayer(layer);
			}
		});

		// Custom heart icon as inline SVG
		const heartIcon = L.divIcon({
			className: 'custom-heart-marker',
			html: `<div class="heart-marker">
				<svg viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" stroke-width="1.5" style="width:28px;height:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));animation:heart-pulse 1.2s ease-in-out infinite">
					<path d="M12 6C12 6 9 2 5.5 2C2.5 2 1 4.5 1 7C1 13 12 21 12 21C12 21 23 13 23 7C23 4.5 21.5 2 18.5 2C15 2 12 6 12 6Z" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</div>`,
			iconSize: [30, 30],
			iconAnchor: [15, 15]
		});

		// Add markers
		completions.forEach((completion) => {
			const marker = L.marker([completion.latitude, completion.longitude], { icon: heartIcon });

			const timeAgo = getTimeAgo(completion.completed_at);
			const location =
				[completion.city, completion.country].filter(Boolean).join(', ') || 'Unknown location';

			marker.bindPopup(`
				<div class="popup-content">
					<strong>"${completion.mission_text}"</strong>
					<br><small><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:2px"><path d="M12 21C12 21 19 14.5 19 9C19 5.13401 15.866 2 12 2C8.13401 2 5 5.13401 5 9C5 14.5 12 21 12 21Z" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 9L11 11L15 7" stroke-linecap="round" stroke-linejoin="round"/></svg> ${location}</small>
					<br><small><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:2px"><circle cx="12" cy="12" r="9"/><path d="M12 6V12L15 15" stroke-linecap="round" stroke-linejoin="round"/></svg> ${timeAgo}</small>
				</div>
			`);

			marker.addTo(map!);
		});
	}

	function getTimeAgo(dateString: string): string {
		const date = new Date(dateString + 'Z');
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	}

	async function handleFilterChange() {
		await loadCompletions();
		if (browser && map) {
			const L = await import('leaflet');
			updateMarkers(L);
		}
	}
</script>

<svelte:head>
	<title>KindSpread - World Map</title>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
	<style>
		.heart-marker {
			text-align: center;
			line-height: 30px;
		}
		.popup-content {
			font-size: 16px;
			line-height: 1.5;
		}
		.leaflet-popup-content-wrapper {
			border-radius: 12px;
		}
		@keyframes heart-pulse {
			0%,
			100% {
				transform: scale(1);
			}
			15% {
				transform: scale(1.15);
			}
			30% {
				transform: scale(1);
			}
			45% {
				transform: scale(1.1);
			}
			60% {
				transform: scale(1);
			}
		}
	</style>
</svelte:head>

<div
	class="flex min-h-screen flex-col transition-colors duration-300 {darkMode
		? 'bg-gray-900'
		: 'bg-linear-to-br from-rose-50 via-amber-50 to-emerald-50'}"
>
	<!-- Header -->
	<header class="flex items-center justify-between px-4 py-4">
		<div class="flex items-center gap-4">
			<a
				href={resolveRoute('/')}
				class="bg-linear-to-r from-rose-500 via-amber-500 to-emerald-500 bg-clip-text text-2xl font-bold text-transparent"
			>
				KindSpread
			</a>
		</div>
		<div class="mr-0 flex items-center gap-4 md:mr-[74px]">
			<select
				bind:value={hoursFilter}
				onchange={handleFilterChange}
				class="cursor-pointer rounded-lg border px-3 py-2 {darkMode
					? 'border-gray-700 bg-gray-800 text-gray-200'
					: 'border-gray-200 bg-white text-gray-800'}"
			>
				<option value={1}>Last hour</option>
				<option value={6}>Last 6 hours</option>
				<option value={24}>Last 24 hours</option>
				<option value={72}>Last 3 days</option>
				<option value={168}>Last week</option>
			</select>
		</div>
	</header>

	<!-- Stats bar -->
	<div class="px-4 pb-4 md:pr-[90px]">
		<div
			class="rounded-xl p-4 {darkMode
				? 'bg-gray-800'
				: 'bg-white/80'} flex items-center justify-between"
		>
			<div class="flex flex-row items-center gap-2">
				<p class="text-xl font-bold {darkMode ? 'text-white' : 'text-gray-800'}">
					{completions.length}
				</p>
				<p class="text-sm {darkMode ? 'text-gray-400' : 'text-gray-500'}">acts of kindness</p>
				{#if !missionCompleted}
					<a
						href={resolveRoute('/')}
						class="rounded-full bg-linear-to-r from-rose-500 to-amber-500 px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-lg"
					>
						Complete Your Mission
					</a>
				{/if}
			</div>
		</div>
	</div>

	<!-- Map -->
	<div class="relative flex-1">
		{#if loading}
			<div
				class="absolute inset-0 flex items-center justify-center {darkMode
					? 'bg-gray-900'
					: 'bg-gray-100'}"
			>
				<div class="text-center">
					<HandHeart size={48} color="#10b981" class="mx-auto mb-2" />
					<p class={darkMode ? 'text-gray-400' : 'text-gray-600'}>
						Loading kindness around the world...
					</p>
				</div>
			</div>
		{/if}
		{#if error}
			<div
				class="absolute inset-0 flex items-center justify-center {darkMode
					? 'bg-gray-900'
					: 'bg-gray-100'}"
			>
				<div class="text-center text-red-500">
					<p>{error}</p>
					<button onclick={loadCompletions} class="mt-2 underline">Retry</button>
				</div>
			</div>
		{/if}
		<div bind:this={mapContainer} class="h-full min-h-125 w-full"></div>
	</div>

	<!-- Footer -->
	<footer class="py-4 text-center {darkMode ? 'text-gray-600' : 'text-gray-400'}">
		<p class="text-xs">
			Built with coffee, Swedish snus and passion for Svelte by <a
				href="https://m7n.dev"
				target="_blank"
				rel="noopener noreferrer"
				class="underline transition-colors hover:text-rose-500">m7n.dev</a
			>
		</p>
	</footer>
</div>
