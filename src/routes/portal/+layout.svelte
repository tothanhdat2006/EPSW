<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		LayoutDashboard,
		ClipboardList,
		FileSearch,
		CheckCircle,
		BrainCircuit,
		UserRound,
		LogOut,
		Inbox,
		Building2,
		Shield
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { authClient } from '$lib/auth-client';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { currentMessages, locale } from '$lib/i18n';
	import {
		getRoleLabel,
		getDepartmentLabel,
		type StaffRole,
		type Department
	} from '$lib/api/types';

	let { children, data } = $props();

	const userRole = $derived(
		(data?.user as { role?: string } | undefined)?.role ?? 'mot_cua'
	) as StaffRole;
	const userDept = $derived(
		(data?.user as { department?: string } | undefined)?.department ?? null
	) as Department | null;

	// Full nav definition — visibility gated by role
	const ALL_NAV = [
		{
			section: () => $currentMessages.overview,
			items: [
				{
					href: '/portal',
					icon: LayoutDashboard,
					label: () => $currentMessages.dashboard,
					exact: true,
					roles: ['admin', 'chuyen_vien', 'lanh_dao']
				}
			]
		},
		{
			section: () => $currentMessages.oneStop,
			items: [
				{
					href: '/portal/reception',
					icon: Inbox,
					label: () => $currentMessages.receptionQueue,
					exact: false,
					roles: ['admin', 'mot_cua']
				}
			]
		},
		{
			section: () => $currentMessages.operations,
			items: [
				{
					href: '/portal/review',
					icon: FileSearch,
					label: () => $currentMessages.reviewQueue,
					exact: false,
					roles: ['admin', 'chuyen_vien']
				},
				{
					href: '/portal/approval',
					icon: CheckCircle,
					label: () => $currentMessages.leadershipApproval,
					exact: false,
					roles: ['admin', 'lanh_dao']
				}
			]
		},
		{
			section: () => $currentMessages.administration,
			items: [
				{
					href: '/portal/users',
					icon: UserRound,
					label: () => $currentMessages.userManagement,
					exact: false,
					roles: ['admin']
				}
			]
		}
	];

	// Filter sections and items by current role
	const NAV = $derived(
		ALL_NAV.map((section) => ({
			...section,
			items: section.items.filter(
				(item) =>
					item.roles.includes(userRole) || (item.roles.includes('admin') && userRole === 'admin')
			)
		})).filter((section) => section.items.length > 0)
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
	<title>{$currentMessages.adminPlatformTitle}</title>
</svelte:head>

<div class="flex h-screen overflow-hidden bg-background">
	<!-- Sidebar -->
	{#if !isLoginPage}
		<aside
			class="flex w-[280px] shrink-0 flex-col border-r border-border/50 bg-muted/20 backdrop-blur-3xl"
		>
			<div
				class="relative flex h-16 shrink-0 items-center overflow-hidden border-b border-border/50 px-6"
			>
				<div
					class="pointer-events-none absolute inset-0 bg-linear-to-r from-primary/10 to-transparent"
				></div>
				<BrainCircuit size={28} class="mr-3 text-primary" />
				<div>
					<h1 class="text-[17px] font-bold tracking-tight text-foreground">
						DVC <span class="text-primary">Admin</span>
					</h1>
					<p
						class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase opacity-80"
					>
						{$currentMessages.adminWorkspace}
					</p>
				</div>
			</div>

			<nav class="flex-1 space-y-4 overflow-y-auto px-4 py-5">
				{#each NAV as section}
					<div>
						<p
							class="mb-2 px-2 text-[10px] font-black tracking-[0.2em] text-muted-foreground/50 uppercase"
						>
							{section.section()}
						</p>
						<div class="space-y-1">
							{#each section.items as item}
								<a href={item.href} class="block border-none outline-none">
									<Button
										variant={isActive(item) ? 'secondary' : 'ghost'}
										class="h-11 w-full justify-start transition-all duration-200 {isActive(item)
											? 'bg-primary/15 font-semibold tracking-wide text-primary hover:bg-primary/25'
											: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'}"
									>
										<item.icon
											size={18}
											class="mr-3 {isActive(item) ? 'text-primary' : 'opacity-70'}"
										/>
										{item.label()}
										{#if isActive(item)}
											<div class="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-primary"></div>
										{/if}
									</Button>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</nav>

			<div class="space-y-3 border-t border-border/50 p-4">
				<ThemeToggle />

				<LocaleSwitcher />

				<!-- User info with role badge -->
				{#if data?.user}
					<div class="rounded-xl border border-white/5 bg-muted/40 p-3 backdrop-blur-md">
						<div class="flex items-center gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/20"
							>
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
								<p class="truncate text-xs font-bold text-foreground">
									{(data.user as { name?: string }).name ?? $currentMessages.defaultStaffName}
								</p>
								<p class="text-[10px] font-semibold text-primary/80">
									{getRoleLabel(userRole, $locale) ?? userRole}
								</p>
								{#if userDept}
									<p class="truncate text-[10px] text-muted-foreground">
										{getDepartmentLabel(userDept, $locale) ?? userDept}
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				<!-- Sign out -->
				<button
					onclick={signOut}
					class="group flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-xs font-bold tracking-wider text-muted-foreground uppercase transition-all hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
				>
					<LogOut size={14} class="transition-colors group-hover:text-destructive" />
					{$currentMessages.signOut}
				</button>
			</div>
		</aside>
	{/if}

	<!-- Main content area -->
	<main class="relative flex-1 overflow-y-auto bg-background">
		<div
			class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-background via-primary/20 to-background"
		></div>
		{@render children()}
	</main>
</div>
