<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { LayoutDashboard, ClipboardList, FileSearch, CheckCircle, BrainCircuit, UserRound, LogOut } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { authClient } from '$lib/auth-client';

	let { children, data } = $props();

	const NAV = [
		{ href: '/portal', icon: LayoutDashboard, label: 'Dashboard', exact: true },
		{ href: '/portal/hitl', icon: ClipboardList, label: 'Hàng đợi HITL', exact: false },
		{ href: '/portal/review', icon: FileSearch, label: 'Kiểm duyệt hồ sơ', exact: false },
		{ href: '/portal/approval', icon: CheckCircle, label: 'Phê duyệt Lãnh đạo', exact: false },
		{ href: '/portal/users', icon: UserRound, label: 'Quản lý nhân sự', exact: false }
	];

	function isActive(item: (typeof NAV)[0]) {
		if (item.exact) return page.url.pathname === item.href;
		return page.url.pathname.startsWith(item.href);
	}

	async function signOut() {
		await authClient.signOut();
		goto('/portal/login', { replaceState: true, invalidateAll: true });
	}
	const isLoginPage = $derived(page.url.pathname === '/portal/login');
</script>

<svelte:head>
	<title>Nền tảng Quản trị thông minh — DVC</title>
</svelte:head>

<div class="flex h-screen overflow-hidden bg-background">
	<!-- Sidebar -->
	{#if !isLoginPage}
		<aside class="flex w-[280px] shrink-0 flex-col border-r border-border/50 bg-muted/20 backdrop-blur-3xl">
			<div class="flex h-16 shrink-0 items-center border-b border-border/50 px-6 px-lg overflow-hidden relative">
				<div class="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none"></div>
				<BrainCircuit size={28} class="text-primary mr-3" />
				<div>
					<h1 class="text-[17px] font-bold tracking-tight text-foreground">DVC <span class="text-primary">Admin</span></h1>
					<p class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase opacity-80">Workspace thông minh</p>
				</div>
			</div>

			<nav class="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
				<p class="px-2 mb-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">Core Modules</p>
				{#each NAV as item}
					<a href={item.href} class="block border-none outline-none">
						<Button
							variant={isActive(item) ? 'secondary' : 'ghost'}
							class="w-full justify-start h-11 transition-all duration-200 {isActive(item) ? 'bg-primary/15 text-primary hover:bg-primary/25 font-semibold tracking-wide' : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'}"
						>
							<item.icon size={18} class="mr-3 {isActive(item) ? 'text-primary' : 'opacity-70'}" />
							{item.label}
							{#if isActive(item)}
								<div class="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
							{/if}
						</Button>
					</a>
				{/each}
			</nav>

			<div class="border-t border-border/50 p-4 relative overflow-hidden space-y-3">
				<div class="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-primary/50 to-purple-500/50"></div>
				<!-- User info -->
				{#if data?.user}
					<div class="rounded-xl bg-muted/40 p-3 backdrop-blur-md border border-white/5 flex items-center gap-3">
						<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
							<UserRound size={18} class="text-primary" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-bold text-foreground truncate">{data.user.name ?? 'Cán bộ'}</p>
							<p class="text-[10px] text-muted-foreground truncate">{data.user.email}</p>
						</div>
					</div>
				{/if}
				<!-- Sign out -->
				<button
					onclick={signOut}
					class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:bg-destructive/10 hover:text-destructive transition-all group border border-transparent hover:border-destructive/20"
				>
					<LogOut size={14} class="group-hover:text-destructive transition-colors" />
					Đăng xuất hệ thống
				</button>
			</div>
		</aside>
	{/if}

	<!-- Main content area -->
	<main class="flex-1 overflow-y-auto relative bg-background">
		<!-- Aesthetic accent for the main content -->
		<div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-background via-primary/20 to-background pointer-events-none"></div>
		{@render children()}
	</main>
</div>
