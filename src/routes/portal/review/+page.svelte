<script lang="ts">
	import { AlertCircle, ArrowLeft } from 'lucide-svelte';
	import { currentMessages } from '$lib/i18n';
</script>

<svelte:head>
	<title>{$currentMessages.notFoundProfile} — DVC Portal</title>
</svelte:head>

<div class="flex h-full items-center justify-center p-8">
	<div class="flex max-w-sm flex-col items-center text-center">
		<div
			class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive"
		>
			<AlertCircle size={40} />
		</div>

		<h1 class="mb-2 text-3xl font-extrabold tracking-tight text-foreground">
			{$currentMessages.notFoundProfile}
		</h1>
		<p class="mb-8 font-medium text-muted-foreground">
			{$currentMessages.notFoundProfileHint}
		</p>

		<a
			href="/portal"
			class="flex h-12 w-full max-w-[200px] items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg transition-all hover:scale-105"
		>
			<ArrowLeft size={18} />
			{$currentMessages.backToDashboard}
		</a>
	</div>
</div>
