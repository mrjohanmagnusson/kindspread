<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { isPushSupported, getNotificationPermission, subscribeToPush } from '$lib/push';
	import { t } from '$lib/i18n';
	import { BellRing } from '@jis3r/icons';

	let show = $state(false);
	let subscribing = $state(false);
	let i18n = $state(t());

	const DISMISS_KEY = 'notif-reminder-dismissed';

	onMount(() => {
		if (!browser) return;

		// Don't show if push not supported or already granted/denied
		if (!isPushSupported()) return;
		const permission = getNotificationPermission();
		if (permission === 'granted' || permission === 'denied') return;

		// Don't show if dismissed in the last 3 days
		const dismissed = localStorage.getItem(DISMISS_KEY);
		if (dismissed) {
			const dismissedAt = parseInt(dismissed, 10);
			const threeDays = 3 * 24 * 60 * 60 * 1000;
			if (Date.now() - dismissedAt < threeDays) return;
		}

		// Show after a short delay (let the page settle)
		setTimeout(() => {
			show = true;
		}, 2000);

		// Listen for locale changes
		const handleLocaleChange = () => {
			i18n = t();
		};
		window.addEventListener('localeChange', handleLocaleChange);
		return () => window.removeEventListener('localeChange', handleLocaleChange);
	});

	async function enableNotifications() {
		subscribing = true;
		try {
			const subscription = await subscribeToPush();
			if (subscription) {
				show = false;
			}
		} finally {
			subscribing = false;
		}
	}

	function dismiss() {
		show = false;
		localStorage.setItem(DISMISS_KEY, Date.now().toString());
	}
</script>

{#if show}
	<div
		class="animate-fade-in mx-auto mt-6 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-md dark:border-amber-900/50 dark:bg-amber-950/30"
	>
		<div class="flex items-start gap-3">
			<div class="mt-0.5 rounded-full bg-amber-100 p-2 dark:bg-amber-900/50">
				<BellRing size={20} class="text-amber-600 dark:text-amber-400" />
			</div>
			<div class="flex-1">
				<h3 class="font-semibold text-gray-900 dark:text-white">{i18n.notifReminderTitle}</h3>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{i18n.notifReminderText}</p>
				<div class="mt-3 flex items-center gap-3">
					<button
						onclick={enableNotifications}
						disabled={subscribing}
						class="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-70"
					>
						{subscribing ? '...' : i18n.notifReminderButton}
					</button>
					<button
						onclick={dismiss}
						class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
					>
						{i18n.notifReminderDismiss}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
