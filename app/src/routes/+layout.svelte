<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { Upload, Search } from 'lucide-svelte';

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
		<header class="border-b border-gray-200 bg-white shadow-sm">
			<div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
				<a href="/" class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
						<span class="text-sm font-bold text-white">DVC</span>
					</div>
					<div>
						<p class="font-bold leading-tight text-gray-900">Cổng Dịch vụ Công</p>
						<p class="text-xs text-gray-500">Nộp và tra cứu hồ sơ trực tuyến</p>
					</div>
				</a>

				<nav class="flex items-center gap-2">
					{#each navItems as item}
						{@const isActive = page.url.pathname === item.href}
						<a
							href={item.href}
							class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
								{isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}"
						>
							<item.icon size={16} />
							{item.label}
						</a>
					{/each}
				</nav>
			</div>
		</header>

		<!-- Page content -->
		<main class="flex-1">
			{@render children()}
		</main>

		<!-- Footer -->
		<footer class="mt-auto border-t border-gray-200 bg-white">
			<div class="mx-auto max-w-4xl px-4 py-4 text-center text-xs text-gray-400">
				Hệ thống DVC — Hỗ trợ: 1900-xxxx | Email: hotro@dvc.gov.vn
			</div>
		</footer>
	</div>
{/if}
