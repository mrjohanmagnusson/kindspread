<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { registerServiceWorker } from '$lib/push';

	let { children } = $props();

	onMount(() => {
		// Register service worker for PWA and push notifications
		registerServiceWorker();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#f43f5e" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="KindSpread" />
	<link rel="apple-touch-icon" href="/icons/icon-192.svg" />
</svelte:head>
{@render children()}
