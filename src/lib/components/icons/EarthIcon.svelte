<script lang="ts">
	interface Props {
		class?: string;
	}
	let { class: className = 'w-6 h-6' }: Props = $props();
</script>

<svg class={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
	<style>
		.earth-spin {
			animation: earth-rotate 8s linear infinite;
			transform-origin: center;
		}
		@keyframes earth-rotate {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}
	</style>
	<g class="earth-spin">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
		<path
			d="M12 3C12 3 8 6 8 12C8 18 12 21 12 21"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
		<path
			d="M12 3C12 3 16 6 16 12C16 18 12 21 12 21"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
		<path d="M3 12H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
		<path d="M4 8H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
		<path d="M4 16H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
	</g>
</svg>
