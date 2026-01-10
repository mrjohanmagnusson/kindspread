<script lang="ts">
	import { browser } from '$app/environment';

	// Sample missions - later this could come from a database
	const missions = [
		"Tell someone you know that you are proud of them",
		"Tell someone you know why you are thankful for them",
		"Send a kind message to someone you haven't talked to in a while",
		"Give a genuine compliment to a stranger",
		"Write a thank you note to someone who helped you recently",
		"Share something positive on social media",
		"Offer to help a colleague or friend with something"
	];

	// Get today's mission based on the date (simple deterministic selection)
	const today = new Date();
	const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
	const todaysMission = missions[dayOfYear % missions.length];

	// Format today's date nicely
	const formattedDate = today.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});

	let missionCompleted = $state(false);

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

			<h2 class="text-2xl font-semibold text-center leading-relaxed mb-8 {darkMode ? 'text-gray-100' : 'text-gray-800'}">
				"{todaysMission}"
			</h2>

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
					</div>
				{:else}
					<button
						onclick={() => missionCompleted = true}
						class="px-8 py-3 bg-linear-to-r from-rose-500 to-amber-500 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer"
					>
						Mark as Complete ✨
					</button>
				{/if}
			</div>
		</div>

		<!-- Stats/Info Section -->
		<div class="mt-8 grid grid-cols-2 gap-4">
			<div class="backdrop-blur rounded-2xl p-6 text-center border transition-colors duration-300 {darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white/60 border-white/80'}">
				<p class="text-3xl font-bold text-rose-500">∞</p>
				<p class="text-sm mt-1 {darkMode ? 'text-gray-400' : 'text-gray-600'}">Acts of Kindness Possible</p>
			</div>
			<div class="backdrop-blur rounded-2xl p-6 text-center border transition-colors duration-300 {darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white/60 border-white/80'}">
				<p class="text-3xl font-bold text-emerald-500">$0</p>
				<p class="text-sm mt-1 {darkMode ? 'text-gray-400' : 'text-gray-600'}">Cost to Be Kind</p>
			</div>
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

