<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { Upload, Search, ShieldCheck } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	let { children } = $props();

	// Portal routes use their own full-page layout (sidebar). Root layout skips public header for them.
	const isPortal = $derived(page.url.pathname.startsWith('/portal'));

	const navItems = [
		{ href: '/', icon: Upload, label: 'Nộp hồ sơ' },
		{ href: '/track', icon: Search, label: 'Tra cứu' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="description" content="Cổng Dịch vụ Công — Nộp và tra cứu hồ sơ trực tuyến" />
</svelte:head>

{#if isPortal}
	{@render children()}
{:else}
	<div class="flex min-h-screen flex-col">
		<!-- Public Header -->
		<header class="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl shadow-sm">
			<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
				<a href="/" class="flex items-center gap-3 group">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 shadow-md group-hover:shadow-primary/20 transition-all">
						<span class="text-sm font-extrabold text-white">DVC</span>
					</div>
					<div>
						<p class="font-bold leading-tight text-foreground tracking-wide group-hover:text-primary transition-colors">Cổng Dịch vụ Công</p>
						<p class="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-0.5">Nộp và tra cứu hồ sơ trực tuyến</p>
					</div>
				</a>

				<div class="flex items-center gap-4">
					<nav class="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/30">
						{#each navItems as item}
							{@const isActive = page.url.pathname === item.href}
							<a
								href={item.href}
								class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all
									{isActive ? 'bg-background shadow-sm text-primary border-border/50 border' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}"
							>
								<item.icon size={16} />
								{item.label}
							</a>
						{/each}
					</nav>

					<div class="w-px h-8 bg-border/50 mx-2"></div>

					<Button variant="outline" class="gap-2 border-primary/20 text-primary hover:bg-primary/10 transition-colors font-bold rounded-xl" href="/portal">
						<ShieldCheck size={16} />
						Dành cho Cán bộ
					</Button>
				</div>
			</div>
		</header>

		<!-- Page content -->
		<main class="flex-1 flex flex-col pt-8">
			{@render children()}
		</main>

		<!-- Footer -->
		<footer class="mt-auto border-t border-border/40 bg-background/40 backdrop-blur-md">
			<div class="mx-auto max-w-5xl px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-widest">
				<div class="flex items-center gap-2">
					<div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
					Hệ thống DVC trực tuyến hoạt động bình thường
				</div>
				<div class="flex items-center gap-4">
					<span>Hỗ trợ: 1900-xxxx</span>
					<span>•</span>
					<span>Email: hotro@dvc.gov.vn</span>
				</div>
			</div>
		</footer>
	</div>
{/if}
