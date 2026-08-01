<script lang="ts">
	import { theme } from './theme.svelte';

	const labels = { light: 'Light', dark: 'Dark', auto: 'Auto' } as const;
	const icons = { light: '☀️', dark: '🌙', auto: '🕐' } as const;
</script>

<button
	type="button"
	onclick={() => theme.cycle()}
	class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
	title="Theme: {labels[theme.preference]} (tap to change)"
	aria-label="Change theme, currently {labels[theme.preference]}"
>
	<span aria-hidden="true">{icons[theme.preference]}</span>
	<span class="hidden sm:inline">{labels[theme.preference]}</span>
</button>
