<script lang="ts">
	import { browser } from '$app/environment';

	let darkMode = $state(true);

	$effect(() => {
		if (browser) {
			const stored = localStorage.getItem('darkMode');
			if (stored !== null) {
				darkMode = stored === 'true';
			}

			const handleDarkModeChange = (e: CustomEvent<boolean>) => {
				darkMode = e.detail;
			};
			window.addEventListener('darkModeChange', handleDarkModeChange as EventListener);

			return () => {
				window.removeEventListener('darkModeChange', handleDarkModeChange as EventListener);
			};
		}
	});
</script>

<svelte:head>
	<title>About - Kindspread</title>
	<meta name="description" content="Learn more about Kindspread - spreading kindness one mission at a time" />
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center p-4 pt-6 pb-24 transition-colors duration-300 {darkMode
		? 'bg-gray-900 text-white'
		: 'bg-linear-to-b from-rose-50 to-amber-50 text-gray-900'}"
>
	<div class="w-full max-w-2xl space-y-6">
		<h1 class="inline-block bg-linear-to-r from-rose-500 via-amber-500 to-emerald-500 bg-clip-text text-4xl font-bold text-transparent md:text-6xl">
			About KindSpread
		</h1>

		<!-- Our Mission -->
		<section class="space-y-4">
			<h2 class="text-2xl font-semibold {darkMode ? 'text-emerald-400' : 'text-emerald-600'}">
				The mission
			</h2>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				Every day at sunrise, KindSpread gives you one small, actionable mission to brighten
				someone's day. Whether it's a genuine compliment to a stranger or a long-overdue text to a
				friend, these tiny ripples create a global wave of change. You can complete your mission and
				watch the world glow on our live map as others join you in real-time.
			</p>
		</section>

		<!-- The Why -->
		<section class="space-y-4">
			<h2 class="text-2xl font-semibold {darkMode ? 'text-amber-400' : 'text-amber-600'}">
				The why
			</h2>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				Honestly? I built this because I'm tired. I'm tired of opening my phone to see news of wars,
				environmental warnings, and a world that feels increasingly divided. It's easy to feel small
				and helpless against the weight of "bad stuff."
			</p>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				But I believe that while we can't stop every war, we can make the person standing next to us
				feel seen. The world doesn't just need more information; it needs more kindness. This app is
				my small way of pushing back against the darkness.
			</p>
		</section>

		<!-- Pure & Simple -->
		<section class="space-y-4">
			<h2 class="text-2xl font-semibold {darkMode ? 'text-rose-400' : 'text-rose-600'}">
				Pure & Simple
			</h2>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				KindSpread is, and will always be, 100% free of charge and free of ads. No tracking, no
				selling your data, just kindness. I cover the server costs myself - It's my way of spreading kindness.
			</p>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				If you find joy in these missions and want to help keep the lights on and the servers
				running, you are more than welcome to
				<a
					href="https://buymeacoffee.com/kindspread"
					target="_blank"
					rel="noopener noreferrer"
					class="font-semibold underline decoration-2 underline-offset-2 transition-colors {darkMode
						? 'text-amber-400 hover:text-amber-300'
						: 'text-amber-600 hover:text-amber-500'}"
				>
					Buy Me a Coffee
				</a>. Every cup helps keep the map glowing. ☕
			</p>
		</section>
	</div>
</div>

