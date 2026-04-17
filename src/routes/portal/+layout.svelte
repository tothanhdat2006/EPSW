<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		LayoutDashboard, ClipboardList, FileSearch, CheckCircle,
		BrainCircuit, UserRound, LogOut, Inbox, Building2, Shield
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { authClient } from '$lib/auth-client';
	import { ROLE_LABELS, DEPARTMENT_LABELS, type StaffRole, type Department } from '$lib/api/types';

	let { children, data } = $props();

	const userRole = $derived((data?.user as { role?: string } | undefined)?.role ?? 'mot_cua') as StaffRole;
	const userDept = $derived((data?.user as { department?: string } | undefined)?.department ?? null) as Department | null;

	// Full nav definition — visibility gated by role
	const ALL_NAV = [
		{
			section: 'Tổng quan',
			items: [
				{ href: '/portal', icon: LayoutDashboard, label: 'Dashboard', exact: true, roles: ['admin', 'chuyen_vien', 'lanh_dao'] },
			]
		},
		{
			section: 'Một cửa',
			items: [
				{ href: '/portal/reception', icon: Inbox, label: 'Tiếp nhận hồ sơ', exact: false, roles: ['admin', 'mot_cua'] },
			]
		},
		{
			section: 'Xử lý nghiệp vụ',
			items: [
				{ href: '/portal/review', icon: FileSearch, label: 'Kiểm duyệt hồ sơ', exact: false, roles: ['admin', 'chuyen_vien'] },
				{ href: '/portal/approval', icon: CheckCircle, label: 'Phê duyệt Lãnh đạo', exact: false, roles: ['admin', 'lanh_dao'] },
			]
		},
		{
			section: 'Quản trị',
			items: [
				{ href: '/portal/users', icon: UserRound, label: 'Quản lý nhân sự', exact: false, roles: ['admin'] },
			]
		},
	];

	// Filter sections and items by current role
	const NAV = $derived(
		ALL_NAV
			.map(section => ({
				...section,
				items: section.items.filter(item =>
					item.roles.includes(userRole) || item.roles.includes('admin') && userRole === 'admin'
				)
			}))
			.filter(section => section.items.length > 0)
	);

	function isActive(item: { href: string; exact: boolean }) {
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
			<div class="flex h-16 shrink-0 items-center border-b border-border/50 px-6 overflow-hidden relative">
				<div class="absolute inset-0 bg-linear-to-r from-primary/10 to-transparent pointer-events-none"></div>
				<BrainCircuit size={28} class="text-primary mr-3" />
				<div>
					<h1 class="text-[17px] font-bold tracking-tight text-foreground">DVC <span class="text-primary">Admin</span></h1>
					<p class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase opacity-80">Workspace thông minh</p>
				</div>
			</div>

			<nav class="flex-1 space-y-4 overflow-y-auto px-4 py-5">
				{#each NAV as section}
					<div>
						<p class="px-2 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{section.section}</p>
						<div class="space-y-1">
							{#each section.items as item}
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
						</div>
					</div>
				{/each}
			</nav>

			<div class="border-t border-border/50 p-4 space-y-3">
				<!-- User info with role badge -->
				{#if data?.user}
					<div class="rounded-xl bg-muted/40 p-3 backdrop-blur-md border border-white/5">
						<div class="flex items-center gap-3">
							<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
								{#if userRole === 'admin'}
									<Shield size={16} class="text-primary" />
								{:else if userRole === 'mot_cua'}
									<Inbox size={16} class="text-primary" />
								{:else if userRole === 'lanh_dao'}
									<CheckCircle size={16} class="text-primary" />
								{:else}
									<Building2 size={16} class="text-primary" />
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-xs font-bold text-foreground truncate">{(data.user as { name?: string }).name ?? 'Cán bộ'}</p>
								<p class="text-[10px] text-primary/80 font-semibold">{ROLE_LABELS[userRole] ?? userRole}</p>
								{#if userDept}
									<p class="text-[10px] text-muted-foreground truncate">{DEPARTMENT_LABELS[userDept] ?? userDept}</p>
								{/if}
							</div>
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
		<div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-background via-primary/20 to-background pointer-events-none"></div>
		{@render children()}
	</main>
</div>
