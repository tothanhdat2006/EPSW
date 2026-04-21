<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { Upload, Search, ShieldCheck } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { currentMessages, initializeLocale } from '$lib/i18n';
	import { initializeTheme } from '$lib/theme';

	let { children } = $props();

	// Portal routes use their own full-page layout (sidebar). Root layout skips public header for them.
	const isPortal = $derived(page.url.pathname.startsWith('/portal'));

	const navItems = [
		{ href: '/', icon: Upload, label: () => $currentMessages.submitProfile },
		{ href: '/track', icon: Search, label: () => $currentMessages.trackProfile }
	];

	onMount(() => {
		initializeTheme();
		initializeLocale();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="description" content={$currentMessages.publicPortalSubtitle} />
</svelte:head>

{#if isPortal}
	{@render children()}
{:else}
	<div class="flex min-h-screen flex-col">
		<!-- Public Header -->
		<header
			class="sticky top-0 z-50 border-b border-border/40 bg-background/60 shadow-sm backdrop-blur-xl"
		>
			<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
				<a href="/" class="group flex items-center gap-3">
					<!-- <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 shadow-md group-hover:shadow-primary/20 transition-all">
						<span class="text-sm font-extrabold text-white">DVC</span>
					</div> -->
					<div>
						<p
							class="leading-tight font-bold tracking-wide text-foreground transition-colors group-hover:text-primary"
						>
							{$currentMessages.publicPortal}
						</p>
						<p class="mt-0.5 text-xs font-medium tracking-widest text-muted-foreground uppercase">
							{$currentMessages.publicPortalSubtitle}
						</p>
					</div>
				</a>

				<div class="flex items-center gap-4">
					<nav class="flex items-center gap-1.5 rounded-xl border border-border/30 bg-muted/30 p-1">
						{#each navItems as item}
							{@const isActive = page.url.pathname === item.href}
							<a
								href={item.href}
								class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all
									{isActive
									? 'border border-border/50 bg-background text-primary shadow-sm'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
							>
								<item.icon size={16} />
								{item.label()}
							</a>
						{/each}
					</nav>

					<ThemeToggle />

					<LocaleSwitcher />

					<div class="mx-2 h-8 w-px bg-border/50"></div>

					<Button
						variant="outline"
						class="gap-2 rounded-xl border-primary/20 font-bold text-primary transition-colors hover:bg-primary/10"
						href="/portal"
					>
						<ShieldCheck size={16} />
						{$currentMessages.forStaff}
					</Button>
				</div>
			</div>
		</header>

		<!-- Page content -->
		<main class="flex flex-1 flex-col pt-8">
			{@render children()}
		</main>

		<!-- Footer -->
		<footer class="mt-auto border-t border-border/40 bg-background/40 backdrop-blur-md">
			<div
				class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs font-medium tracking-widest text-muted-foreground uppercase md:flex-row"
			>
				<div class="flex items-center gap-2">
					<div
						class="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
					></div>
					{$currentMessages.systemOnline}
				</div>
				<div class="flex items-center gap-4">
					<span>{$currentMessages.support}: 1900-xxxx</span>
					<span>•</span>
					<span>{$currentMessages.email}: hotro@dvc.gov.vn</span>
				</div>
			</div>
		</footer>
	</div>
{/if}
