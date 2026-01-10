<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

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
	let hoursFilter = $state(24);

	// Dark mode (same as main page)
	let darkMode = $state(false);

	onMount(async () => {
		if (browser) {
			const stored = localStorage.getItem('darkMode');
			if (stored !== null) {
				darkMode = stored === 'true';
			} else {
				darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
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

		// Custom heart icon
		const heartIcon = L.divIcon({
			className: 'custom-heart-marker',
			html: '<div class="heart-marker">💝</div>',
			iconSize: [30, 30],
			iconAnchor: [15, 15]
		});

		// Add markers
		completions.forEach((completion) => {
			const marker = L.marker([completion.latitude, completion.longitude], { icon: heartIcon });

			const timeAgo = getTimeAgo(completion.completed_at);
			const location = [completion.city, completion.country].filter(Boolean).join(', ') || 'Unknown location';

			marker.bindPopup(`
				<div class="popup-content">
					<strong>"${completion.mission_text}"</strong>
					<br><small>📍 ${location}</small>
					<br><small>🕐 ${timeAgo}</small>
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

	function toggleDarkMode() {
		darkMode = !darkMode;
		if (browser) {
			localStorage.setItem('darkMode', String(darkMode));
		}
	}
</script>

<svelte:head>
	<title>KindSpread - World Map</title>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
	<style>
		.heart-marker {
			font-size: 24px;
			text-align: center;
			line-height: 30px;
			filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
		}
		.popup-content {
			font-size: 14px;
			line-height: 1.5;
		}
		.leaflet-popup-content-wrapper {
			border-radius: 12px;
		}
	</style>
</svelte:head>

<div class="min-h-screen flex flex-col transition-colors duration-300 {darkMode ? 'bg-gray-900' : 'bg-linear-to-br from-rose-50 via-amber-50 to-emerald-50'}">
	<!-- Header -->
	<header class="py-4 px-4 flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a href="/" class="text-2xl font-bold bg-linear-to-r from-rose-500 via-amber-500 to-emerald-500 bg-clip-text text-transparent">
				KindSpread
			</a>
			<span class="{darkMode ? 'text-gray-400' : 'text-gray-600'}">World Map</span>
		</div>
		<div class="flex items-center gap-4">
			<select
				bind:value={hoursFilter}
				onchange={handleFilterChange}
				class="px-3 py-2 rounded-lg border cursor-pointer {darkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}"
			>
				<option value={1}>Last hour</option>
				<option value={6}>Last 6 hours</option>
				<option value={24}>Last 24 hours</option>
				<option value={72}>Last 3 days</option>
				<option value={168}>Last week</option>
			</select>
			<button
				onclick={toggleDarkMode}
				class="p-2 rounded-full {darkMode ? 'bg-gray-800 text-yellow-400' : 'bg-white text-gray-700'}"
			>
				{#if darkMode}☀️{:else}🌙{/if}
			</button>
		</div>
	</header>

	<!-- Stats bar -->
	<div class="px-4 pb-4">
		<div class="rounded-xl p-4 {darkMode ? 'bg-gray-800' : 'bg-white/80'} flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="text-2xl">💝</span>
				<div>
					<p class="font-bold text-lg {darkMode ? 'text-white' : 'text-gray-800'}">
						{completions.length}
					</p>
					<p class="text-sm {darkMode ? 'text-gray-400' : 'text-gray-500'}">
						acts of kindness
					</p>
				</div>
			</div>
			<a
				href="/"
				class="px-4 py-2 rounded-full bg-linear-to-r from-rose-500 to-amber-500 text-white text-sm font-medium hover:shadow-lg transition-all"
			>
				Complete Your Mission
			</a>
		</div>
	</div>

	<!-- Map -->
	<div class="flex-1 relative">
		{#if loading}
			<div class="absolute inset-0 flex items-center justify-center {darkMode ? 'bg-gray-900' : 'bg-gray-100'}">
				<div class="text-center">
					<div class="text-4xl mb-2">🌍</div>
					<p class="{darkMode ? 'text-gray-400' : 'text-gray-600'}">Loading kindness around the world...</p>
				</div>
			</div>
		{/if}
		{#if error}
			<div class="absolute inset-0 flex items-center justify-center {darkMode ? 'bg-gray-900' : 'bg-gray-100'}">
				<div class="text-center text-red-500">
					<p>{error}</p>
					<button onclick={loadCompletions} class="mt-2 underline">Retry</button>
				</div>
			</div>
		{/if}
		<div bind:this={mapContainer} class="w-full h-full min-h-125"></div>
	</div>

	<!-- Footer -->
	<footer class="py-4 text-center {darkMode ? 'text-gray-600' : 'text-gray-400'}">
		<p class="text-xs">
			Built with ☕ Swedish snus and passion for Svelte by <a href="https://m7n.dev" target="_blank" rel="noopener noreferrer" class="underline hover:text-rose-500 transition-colors">m7n.dev</a>
		</p>
	</footer>
</div>

