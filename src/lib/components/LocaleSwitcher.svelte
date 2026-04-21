<script lang="ts">
	import Languages from '@lucide/svelte/icons/languages';
	import { LOCALE_LABELS, UI_LOCALES, locale, setLocale } from '$lib/i18n';
</script>

<div
	class="inline-flex items-center gap-1 rounded-2xl border border-border/40 bg-background/70 p-1 shadow-sm backdrop-blur-md"
>
	<div
		class="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-muted/30 text-muted-foreground"
	>
		<Languages size={14} />
	</div>

	<div class="grid grid-cols-2 gap-1">
		{#each UI_LOCALES as option}
			<button
				type="button"
				onclick={() => setLocale(option)}
				aria-pressed={$locale === option}
				class="min-w-[92px] rounded-xl px-3 py-2 text-xs font-bold tracking-wide transition-all
					{$locale === option
					? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
					: 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
			>
				{LOCALE_LABELS[option]}
			</button>
		{/each}
	</div>
</div>
