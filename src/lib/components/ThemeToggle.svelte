<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { onMount } from 'svelte';
	import { initializeTheme, setTheme, type Theme } from '$lib/theme';

	let theme = $state<Theme>('light');

	const isDark = $derived(theme === 'dark');
	const toggleLabel = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');

	onMount(() => {
		theme = initializeTheme();
	});

	function toggleTheme() {
		theme = isDark ? 'light' : 'dark';
		setTheme(theme);
	}
</script>

<button
	type="button"
	onclick={toggleTheme}
	aria-label={toggleLabel}
	title={toggleLabel}
	class="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/40 bg-background/70 px-3 text-xs font-bold tracking-wide text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
>
	<span
		class="flex h-7 w-7 items-center justify-center rounded-xl border border-border/40 bg-muted/30 text-muted-foreground"
	>
		{#if isDark}
			<Moon size={14} />
		{:else}
			<Sun size={14} />
		{/if}
	</span>
	<span>{isDark ? 'Dark' : 'Light'}</span>
</button>
