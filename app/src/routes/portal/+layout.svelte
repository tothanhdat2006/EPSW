<script lang="ts">
	import { page } from '$app/state';
	import { LayoutDashboard, ClipboardList, FileSearch, CheckCircle } from 'lucide-svelte';

	let { children } = $props();

	const NAV = [
		{ href: '/portal', icon: LayoutDashboard, label: 'Dashboard', exact: true },
		{ href: '/portal/hitl', icon: ClipboardList, label: 'Hàng đợi HITL', exact: false },
		{ href: '/portal/review', icon: FileSearch, label: 'Kiểm duyệt hồ sơ', exact: false },
		{ href: '/portal/approval', icon: CheckCircle, label: 'Phê duyệt Lãnh đạo', exact: false }
	];

	function isActive(item: (typeof NAV)[0]) {
		if (item.exact) return page.url.pathname === item.href;
		return page.url.pathname.startsWith(item.href);
	}
</script>

<svelte:head>
	<title>Cổng Tác Nghiệp — DVC Workflow System</title>
</svelte:head>

<div class="flex h-screen overflow-hidden bg-gray-50">
	<!-- Sidebar -->
	<aside class="flex w-64 flex-col bg-blue-900 text-white shadow-xl">
		<div class="border-b border-blue-800 px-6 py-5">
			<h1 class="text-lg font-bold leading-tight">Hệ thống DVC</h1>
			<p class="mt-0.5 text-xs text-blue-300">Cổng tác nghiệp nội bộ</p>
		</div>

		<nav class="flex-1 space-y-1 px-3 py-4">
			{#each NAV as item}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors
						{isActive(item)
						? 'bg-blue-700 text-white'
						: 'text-blue-200 hover:bg-blue-800 hover:text-white'}"
				>
					<item.icon size={18} />
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="border-t border-blue-800 px-6 py-4 text-xs text-blue-400">
			v1.0.0 — DVC Workflow System
		</div>
	</aside>

	<!-- Main content area -->
	<main class="flex-1 overflow-y-auto">
		{@render children()}
	</main>
</div>
