<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { registerServiceWorker } from '$lib/push';
	import { initLocale } from '$lib/i18n';
	import FloatingNav from '$lib/components/FloatingNav.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';

	let { children, data } = $props();

	// Initialize locale from server-detected country (runs once on hydration)
	$effect(() => {
		initLocale(data.locale?.country);
	});

	onMount(() => {
		// Register service worker for PWA and push notifications
		registerServiceWorker();
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#f43f5e" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="KindSpread" />
	<link rel="apple-touch-icon" href="/icons/icon-192.svg" />
</svelte:head>

<FloatingNav />
<InstallPrompt />
{@render children()}
