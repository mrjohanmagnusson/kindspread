<script lang="ts">
	import { browser } from '$app/environment';
	import { initDarkMode, getDarkMode } from '$lib/stores/dark-mode';
	import { getLocale, t, type Locale } from '$lib/i18n';

	let darkMode = $state(true);
	let locale = $state<Locale>(getLocale());
	let i18n = $state(t());

	$effect(() => {
		if (browser) {
			initDarkMode();
			darkMode = getDarkMode();

			const handleDarkModeChange = (e: CustomEvent<boolean>) => {
				darkMode = e.detail;
			};
			window.addEventListener('darkModeChange', handleDarkModeChange as EventListener);

			const handleLocaleChange = (e: CustomEvent<Locale>) => {
				locale = e.detail;
				i18n = t();
			};
			window.addEventListener('localeChange', handleLocaleChange as EventListener);

			return () => {
				window.removeEventListener('darkModeChange', handleDarkModeChange as EventListener);
				window.removeEventListener('localeChange', handleLocaleChange as EventListener);
			};
		}
	});
</script>

<svelte:head>
	<title>{i18n.infoTitle}</title>
	<meta
		name="description"
		content="Learn more about Kindspread - spreading kindness one mission at a time"
	/>
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center p-4 pt-6 pb-24 transition-colors duration-300 {darkMode
		? 'bg-gray-900 text-white'
		: 'bg-linear-to-b from-rose-50 to-amber-50 text-gray-900'}"
>
	<div class="w-full max-w-2xl space-y-6">
		<h1
			class="inline-block bg-linear-to-r from-rose-500 via-amber-500 to-emerald-500 bg-clip-text text-4xl font-bold text-transparent md:text-6xl"
		>
			{i18n.aboutKindSpread}
		</h1>

		<!-- Our Mission -->
		<section class="space-y-4">
			<h2 class="text-2xl font-semibold {darkMode ? 'text-emerald-400' : 'text-emerald-600'}">
				{i18n.theMission}
			</h2>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				{i18n.theMissionText}
			</p>
		</section>

		<!-- The Why -->
		<section class="space-y-4">
			<h2 class="text-2xl font-semibold {darkMode ? 'text-amber-400' : 'text-amber-600'}">
				{i18n.theWhy}
			</h2>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				{i18n.theWhyText1}
			</p>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				{i18n.theWhyText2}
			</p>
		</section>

		<!-- Pure & Simple -->
		<section class="space-y-4">
			<h2 class="text-2xl font-semibold {darkMode ? 'text-rose-400' : 'text-rose-600'}">
				{i18n.pureSimple}
			</h2>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				{i18n.pureSimpleText}
			</p>
			<p class="text-lg leading-relaxed {darkMode ? 'text-gray-300' : 'text-gray-700'}">
				{i18n.coffeeText}
				<a
					href="https://buymeacoffee.com/kindspread"
					target="_blank"
					rel="noopener noreferrer"
					class="font-semibold underline decoration-2 underline-offset-2 transition-colors {darkMode
						? 'text-amber-400 hover:text-amber-300'
						: 'text-amber-600 hover:text-amber-500'}"
				>
					{i18n.buyMeACoffee}
				</a>{i18n.coffeeTextEnd}
			</p>
		</section>
	</div>
</div>
