<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';

	let deferredPrompt = $state<any>(null);
	let showPrompt = $state(false);
	let isIOS = $state(false);
	let isStandalone = $state(false);
	let i18n = $state(t());

	onMount(() => {
		if (!browser) return;

		// Check if already installed (standalone mode)
		isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as any).standalone === true;

		if (isStandalone) return;

		// Check if user dismissed the prompt recently (don't show for 7 days)
		const dismissed = localStorage.getItem('pwa-install-dismissed');
		if (dismissed) {
			const dismissedAt = parseInt(dismissed, 10);
			const sevenDays = 7 * 24 * 60 * 60 * 1000;
			if (Date.now() - dismissedAt < sevenDays) return;
		}

		// Detect iOS
		const ua = navigator.userAgent;
		isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;

		// Listen for the beforeinstallprompt event (Android/Chrome/Edge)
		window.addEventListener('beforeinstallprompt', (e: Event) => {
			e.preventDefault();
			deferredPrompt = e;
			showPrompt = true;
		});

		// On iOS, show a manual instruction prompt
		if (isIOS && !isStandalone) {
			showPrompt = true;
		}

		// Hide prompt if app gets installed
		window.addEventListener('appinstalled', () => {
			showPrompt = false;
			deferredPrompt = null;
		});
	});

	async function handleInstall() {
		if (deferredPrompt) {
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'accepted') {
				showPrompt = false;
			}
			deferredPrompt = null;
		}
	}

	function dismiss() {
		showPrompt = false;
		localStorage.setItem('pwa-install-dismissed', Date.now().toString());
	}
</script>

{#if showPrompt}
	<div
		class="fixed right-4 bottom-20 left-4 z-50 mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
	>
		<button
			onclick={dismiss}
			class="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
			aria-label="Dismiss"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>

		<div class="flex items-start gap-3">
			<img src="/icons/icon-192.svg" alt="KindSpread" class="h-12 w-12 rounded-xl" />
			<div class="flex-1">
				<h3 class="font-semibold text-gray-900 dark:text-white">{i18n.installTitle}</h3>
				{#if isIOS}
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
						{i18n.installIOSText}
						<svg class="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
							/>
						</svg>
						{i18n.installIOSAction}
					</p>
				{:else}
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
						{i18n.installText}
					</p>
					<button
						onclick={handleInstall}
						class="mt-3 rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600"
					>
						{i18n.installButton}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
