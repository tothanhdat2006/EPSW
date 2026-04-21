<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import {
		UserPlus,
		Search,
		ShieldCheck,
		Mail,
		Calendar,
		UserRound,
		Loader2,
		X,
		Lock,
		Building2,
		Inbox,
		ChevronDown,
		Pencil
	} from 'lucide-svelte';
	import { format } from 'date-fns';
	import { getDateLocale, locale } from '$lib/i18n';
	import {
		ROLE_LABELS,
		DEPARTMENT_LABELS,
		VALID_ROLES,
		VALID_DEPARTMENTS,
		ROLES_WITH_DEPARTMENT,
		type StaffRole,
		type Department
	} from '$lib/api/types';

	// ─── State ─────────────────────────────────────────────────────────────────
	let users = $state<any[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let showCreateModal = $state(false);
	let filterRole = $state<string>('');

	// Form state
	let newUser = $state({
		name: '',
		email: '',
		password: '',
		role: 'mot_cua' as StaffRole,
		department: '' as Department | ''
	});
	let isCreating = $state(false);
	let createError = $state<string | null>(null);

	const needsDept = $derived(ROLES_WITH_DEPARTMENT.includes(newUser.role));

	let showEditModal = $state(false);
	let editingUser = $state<any>(null);
	let isUpdatingRole = $state(false);
	let updateError = $state<string | null>(null);

	let editNeedsDept = $derived(
		editingUser ? ROLES_WITH_DEPARTMENT.includes(editingUser.role) : false
	);

	const ui = $derived(
		$locale === 'en'
			? {
					pageTitle: 'Staff Directory',
					pageSubtitle: 'Manage accounts and workflow permissions by role',
					addStaff: 'Add new staff',
					accountCatalog: 'Account catalog',
					searchPlaceholder: 'Search by name or email...',
					loading: 'Loading staff list...',
					empty: 'No staff found',
					name: 'Full Name',
					role: 'Role',
					department: 'Department',
					createdAt: 'Created at',
					actions: 'Actions',
					createTitle: 'Create New Staff Account',
					createDescription: 'Issue a new identity for a staff member in the DVC workflow system.',
					emailLabel: 'Email Address',
					initialPassword: 'Initial Password',
					selectDepartment: 'Select Department',
					cancel: 'Cancel',
					creating: 'Creating...',
					confirmProvision: 'Confirm Provisioning',
					editTitle: 'Update Role',
					editPrefix: 'Change workflow permissions for',
					newRole: 'New Role',
					selectDepartmentPlaceholder: 'Select a responsible department...',
					processing: 'Processing...',
					update: 'Update',
					deptRequiredError: 'Please select a responsible department.',
					systemError: 'A system error occurred.',
					unknownCreateError: 'Unknown error while creating the account',
					retryError: 'A system error occurred. Please try again later.'
				}
			: {
					pageTitle: 'Đội ngũ Cán bộ',
					pageSubtitle: 'Quản lý tài khoản và phân quyền nghiệp vụ theo vai trò',
					addStaff: 'Thêm cán bộ mới',
					accountCatalog: 'Danh mục tài khoản',
					searchPlaceholder: 'Tìm theo tên hoặc email...',
					loading: 'Đang tải danh sách cán bộ...',
					empty: 'Không tìm thấy cán bộ',
					name: 'Họ và Tên',
					role: 'Vai trò',
					department: 'Đơn vị',
					createdAt: 'Ngày tạo',
					actions: 'Thao tác',
					createTitle: 'Khởi tạo Cán bộ mới',
					createDescription: 'Cấp phát định danh mới cho cán bộ vào hệ thống nghiệp vụ DVC.',
					emailLabel: 'Địa chỉ Email',
					initialPassword: 'Mật khẩu khởi tạo',
					selectDepartment: 'Chọn đơn vị',
					cancel: 'Hủy bỏ',
					creating: 'Đang khởi tạo...',
					confirmProvision: 'Xác nhận cấp phát',
					editTitle: 'Cập nhật Vai trò',
					editPrefix: 'Thay đổi phân quyền nghiệp vụ cho',
					newRole: 'Vai trò mới',
					selectDepartmentPlaceholder: 'Chọn đơn vị phụ trách...',
					processing: 'Xử lý...',
					update: 'Cập nhật',
					deptRequiredError: 'Vui lòng chọn đơn vị phụ trách.',
					systemError: 'Đã xảy ra lỗi hệ thống.',
					unknownCreateError: 'Lỗi không xác định khi tạo tài khoản',
					retryError: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.'
				}
	);

	function openEditModal(user: any) {
		editingUser = { ...user };
		if (!editingUser.department) editingUser.department = '';
		showEditModal = true;
	}

	async function handleUpdateRole(e: SubmitEvent) {
		e.preventDefault();
		if (!editingUser) return;

		if (editNeedsDept && !editingUser.department) {
			updateError = ui.deptRequiredError;
			return;
		}

		isUpdatingRole = true;
		updateError = null;
		try {
			const { error: roleError } = await authClient.admin.setRole({
				userId: editingUser.id,
				role: editingUser.role
			});
			if (roleError) throw roleError;

			// Update department via generic fetch
			const { error: dataError } = await authClient.$fetch<any>('/admin/update-user', {
				method: 'POST',
				body: {
					userId: editingUser.id,
					data: {
						department: editNeedsDept ? editingUser.department : null
					}
				}
			});
			if (dataError) throw dataError;

			showEditModal = false;
			await loadUsers();
		} catch (e: any) {
			updateError = e.message || ui.systemError;
		} finally {
			isUpdatingRole = false;
		}
	}

	// ─── Logic ──────────────────────────────────────────────────────────────────
	async function loadUsers() {
		isLoading = true;
		try {
			const { data, error } = await authClient.admin.listUsers({ query: { limit: 200 } });
			if (error) throw error;
			users = data?.users || [];
		} catch (e) {
			console.error('Failed to load users:', e);
		} finally {
			isLoading = false;
		}
	}

	async function handleCreateUser(e: SubmitEvent) {
		e.preventDefault();
		if (needsDept && !newUser.department) {
			createError = ui.deptRequiredError;
			return;
		}
		isCreating = true;
		createError = null;
		try {
			const { error } = await authClient.admin.createUser({
				email: newUser.email,
				password: newUser.password,
				name: newUser.name,
				data: {
					role: newUser.role,
					...(newUser.department ? { department: newUser.department } : {})
				}
			});
			if (error) {
				createError = error.message || ui.unknownCreateError;
				return;
			}
			showCreateModal = false;
			newUser = { name: '', email: '', password: '', role: 'mot_cua', department: '' };
			await loadUsers();
		} catch (e) {
			createError = ui.retryError;
		} finally {
			isCreating = false;
		}
	}

	onMount(() => {
		loadUsers();
	});

	const filteredUsers = $derived(
		users.filter((u) => {
			const matchSearch =
				u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				u.email.toLowerCase().includes(searchQuery.toLowerCase());
			const matchRole = !filterRole || u.role === filterRole;
			return matchSearch && matchRole;
		})
	);

	function getRoleBadgeClass(role: string) {
		const map: Record<string, string> = {
			admin: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
			mot_cua: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
			chuyen_vien: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
			lanh_dao: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
		};
		return map[role] ?? 'bg-muted/20 text-muted-foreground border border-border/30';
	}
</script>

<svelte:head>
	<title>{ui.pageTitle} — DVC Portal</title>
</svelte:head>

<div class="relative min-h-full p-8">
	<!-- Header -->
	<div class="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-foreground">{ui.pageTitle}</h1>
			<p class="mt-2 font-medium text-muted-foreground">{ui.pageSubtitle}</p>
		</div>
		<Button
			onclick={() => (showCreateModal = true)}
			class="group h-12 shrink-0 rounded-2xl bg-primary px-6 text-primary-foreground transition-all hover:shadow-[0_0_20px_rgba(var(--primary),0.3)]"
		>
			<UserPlus size={18} class="mr-2 transition-transform group-hover:scale-110" />
			{ui.addStaff}
		</Button>
	</div>

	<!-- Role stats -->
	<div class="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
		{#each VALID_ROLES as role}
			<button
				onclick={() => (filterRole = filterRole === role ? '' : role)}
				class="rounded-2xl border p-4 text-left transition-all
					{filterRole === role
					? 'border-primary bg-primary/5'
					: 'border-border/40 bg-muted/10 hover:border-border/60'}"
			>
				<p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
					{ROLE_LABELS[role]}
				</p>
				<p class="mt-1 text-2xl font-black text-foreground">
					{users.filter((u) => u.role === role).length}
				</p>
			</button>
		{/each}
	</div>

	<!-- User table -->
	<Card class="overflow-hidden rounded-3xl border-border/40 bg-muted/5 shadow-2xl backdrop-blur-md">
		<CardHeader class="border-b border-border/40 bg-muted/10 px-6 py-5">
			<div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
				<CardTitle class="flex items-center text-lg font-bold">
					<ShieldCheck size={20} class="mr-2 text-primary" />
					{ui.accountCatalog}
					{filterRole ? `— ${ROLE_LABELS[filterRole as StaffRole]}` : ''}
				</CardTitle>
				<div class="group relative w-full md:w-80">
					<Search
						size={16}
						class="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
					/>
					<Input
						type="text"
						placeholder={ui.searchPlaceholder}
						bind:value={searchQuery}
						class="h-10 rounded-xl border-border/50 bg-background/50 pl-10"
					/>
				</div>
			</div>
		</CardHeader>
		<CardContent class="p-0">
			{#if isLoading}
				<div class="flex flex-col items-center justify-center gap-4 py-20">
					<Loader2 size={40} class="animate-spin text-primary/50" />
					<p class="animate-pulse font-medium text-muted-foreground">{ui.loading}</p>
				</div>
			{:else if filteredUsers.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center">
					<div class="mb-4 rounded-full border border-dashed border-border/40 bg-muted/20 p-6">
						<UserRound size={40} class="text-muted-foreground/30" />
					</div>
					<h3 class="text-lg font-bold text-foreground">{ui.empty}</h3>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-left">
						<thead>
							<tr
								class="border-b border-border/40 bg-muted/5 text-[11px] font-bold tracking-[0.15em] text-muted-foreground/60 uppercase"
							>
								<th class="px-6 py-4">{ui.name}</th>
								<th class="px-6 py-4">Email</th>
								<th class="px-6 py-4">{ui.role}</th>
								<th class="px-6 py-4">{ui.department}</th>
								<th class="px-6 py-4">{ui.createdAt}</th>
								<th class="px-6 py-4 text-right">{ui.actions}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/20">
							{#each filteredUsers as user}
								<tr class="group/row transition-colors hover:bg-primary/5">
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-linear-to-br from-primary/20 to-primary/5 font-bold text-primary shadow-sm transition-transform group-hover/row:scale-105"
											>
												{user.name?.charAt(0).toUpperCase() || 'U'}
											</div>
											<span class="font-bold tracking-tight text-foreground">{user.name}</span>
										</div>
									</td>
									<td class="px-6 py-4">
										<div class="flex items-center gap-2 font-medium text-muted-foreground">
											<Mail size={14} class="opacity-50" />
											{user.email}
										</div>
									</td>
									<td class="px-6 py-4">
										<span
											class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold {getRoleBadgeClass(
												user.role
											)}"
										>
											{ROLE_LABELS[user.role as StaffRole] ?? user.role}
										</span>
									</td>
									<td class="px-6 py-4">
										{#if user.department}
											<div
												class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
											>
												<Building2 size={12} class="opacity-60" />
												{DEPARTMENT_LABELS[user.department as Department] ?? user.department}
											</div>
										{:else}
											<span class="text-[11px] text-muted-foreground/40">—</span>
										{/if}
									</td>
									<td class="px-6 py-4 font-mono text-xs text-muted-foreground/80">
										{format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm', {
											locale: getDateLocale($locale)
										})}
									</td>
									<td class="px-6 py-4 text-right">
										<Button
											variant="ghost"
											size="sm"
											onclick={() => openEditModal(user)}
											class="h-8 w-8 rounded-lg p-0 text-primary opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-primary/10"
										>
											<Pencil size={14} />
										</Button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Create User Modal -->
	{#if showCreateModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				class="absolute inset-0 animate-in bg-background/80 backdrop-blur-md duration-300 fade-in"
				aria-label="Close create user modal"
				onclick={() => (showCreateModal = false)}
			></button>

			<Card
				class="relative w-full max-w-lg animate-in overflow-hidden rounded-[2rem] border-border bg-card/95 shadow-2xl duration-300 zoom-in-95 slide-in-from-bottom-4"
			>
				<div
					class="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary"
				></div>
				<CardHeader class="pb-4">
					<div class="flex items-center justify-between">
						<CardTitle class="text-2xl font-black">{ui.createTitle}</CardTitle>
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 rounded-full"
							onclick={() => (showCreateModal = false)}
						>
							<X size={18} />
						</Button>
					</div>
					<CardDescription class="font-medium text-muted-foreground">
						{ui.createDescription}
					</CardDescription>
				</CardHeader>

				<form onsubmit={handleCreateUser} class="space-y-4 p-6 pt-0">
					{#if createError}
						<div
							class="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-bold text-destructive"
						>
							<X size={14} />
							{createError}
						</div>
					{/if}

					<div class="space-y-2">
						<Label
							for="name"
							class="ml-1 text-xs font-black tracking-widest text-muted-foreground/80 uppercase"
							>{ui.name}</Label
						>
						<Input
							id="name"
							placeholder="VD: Nguyễn Văn A"
							bind:value={newUser.name}
							required
							class="h-12 rounded-2xl border-border/40 bg-muted/30"
						/>
					</div>

					<div class="space-y-2">
						<Label
							for="email"
							class="ml-1 text-xs font-black tracking-widest text-muted-foreground/80 uppercase"
							>{ui.emailLabel}</Label
						>
						<Input
							id="email"
							type="email"
							placeholder="example@dvc.gov.vn"
							bind:value={newUser.email}
							required
							class="h-12 rounded-2xl border-border/40 bg-muted/30"
						/>
					</div>

					<div class="space-y-2">
						<Label
							for="password"
							class="ml-1 text-xs font-black tracking-widest text-muted-foreground/80 uppercase"
							>{ui.initialPassword}</Label
						>
						<Input
							id="password"
							type="password"
							placeholder="••••••••"
							bind:value={newUser.password}
							required
							minlength={8}
							class="h-12 rounded-2xl border-border/40 bg-muted/30"
						/>
					</div>

					<!-- Role selection -->
					<div class="space-y-2">
						<Label
							class="ml-1 text-xs font-black tracking-widest text-muted-foreground/80 uppercase"
							>{ui.role}</Label
						>
						<div class="grid grid-cols-2 gap-2">
							{#each VALID_ROLES as role}
								<label
									class="flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition-all
									{newUser.role === role
										? 'border-primary bg-primary/5'
										: 'border-border/30 hover:border-primary/30'}"
								>
									<input
										type="radio"
										name="role"
										value={role}
										bind:group={newUser.role}
										class="sr-only"
									/>
									<div
										class="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2
										{newUser.role === role ? 'border-primary bg-primary' : 'border-muted-foreground/30'}"
									>
										{#if newUser.role === role}
											<div class="h-1 w-1 rounded-full bg-white"></div>
										{/if}
									</div>
									<span
										class="text-xs font-semibold {newUser.role === role
											? 'text-primary'
											: 'text-foreground'}"
									>
										{ROLE_LABELS[role]}
									</span>
								</label>
							{/each}
						</div>
					</div>

					<!-- Department (conditional) -->
					{#if needsDept}
						<div class="animate-in space-y-2 duration-200 slide-in-from-top-2">
							<Label
								class="ml-1 text-xs font-black tracking-widest text-muted-foreground/80 uppercase"
							>
								{ui.department} <span class="text-destructive">*</span>
							</Label>
							<div class="relative">
								<Building2
									size={16}
									class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
								/>
								<select
									bind:value={newUser.department}
									class="h-12 w-full cursor-pointer appearance-none rounded-2xl border border-border/40 bg-muted/30 pr-4 pl-10 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
								>
									<option value="">— {ui.selectDepartment} —</option>
									{#each VALID_DEPARTMENTS as dept}
										<option value={dept}>{DEPARTMENT_LABELS[dept]}</option>
									{/each}
								</select>
								<ChevronDown
									size={14}
									class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground"
								/>
							</div>
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-4 pt-2">
						<Button
							type="button"
							variant="outline"
							class="h-12 rounded-2xl border-border/40 font-bold"
							onclick={() => (showCreateModal = false)}
						>
							{ui.cancel}
						</Button>
						<Button
							type="submit"
							disabled={isCreating}
							class="h-12 rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20"
						>
							{#if isCreating}
								<Loader2 size={18} class="mr-2 animate-spin" /> {ui.creating}
							{:else}
								{ui.confirmProvision}
							{/if}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	{/if}

	<!-- Edit Role Modal -->
	{#if showEditModal && editingUser}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				class="absolute inset-0 animate-in bg-background/80 backdrop-blur-md duration-300 fade-in"
				aria-label="Close edit user modal"
				onclick={() => (showEditModal = false)}
			></button>

			<Card
				class="relative w-full max-w-lg animate-in overflow-hidden rounded-[2rem] border-border bg-card/95 shadow-2xl duration-300 zoom-in-95 slide-in-from-bottom-4"
			>
				<div class="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-amber-500 to-amber-300"></div>
				<CardHeader class="pb-4">
					<div class="flex items-center justify-between">
						<CardTitle class="text-2xl font-black">{ui.editTitle}</CardTitle>
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 rounded-full"
							onclick={() => (showEditModal = false)}
						>
							<X size={18} />
						</Button>
					</div>
					<CardDescription class="font-medium text-muted-foreground">
						{ui.editPrefix} <span class="font-bold text-foreground">{editingUser.name}</span>.
					</CardDescription>
				</CardHeader>

				<form onsubmit={handleUpdateRole} class="space-y-4 p-6 pt-0">
					{#if updateError}
						<div
							class="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-bold text-destructive"
						>
							<X size={14} />
							{updateError}
						</div>
					{/if}

					<!-- Role selection -->
					<div class="space-y-2">
						<Label
							class="ml-1 text-xs font-black tracking-widest text-muted-foreground/80 uppercase"
							>{ui.newRole}</Label
						>
						<div class="grid grid-cols-2 gap-2">
							{#each VALID_ROLES as role}
								<label
									class="flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition-all
									{editingUser.role === role
										? 'border-amber-500 bg-amber-500/5'
										: 'border-border/30 hover:border-amber-500/30'}"
								>
									<input
										type="radio"
										name="editRole"
										value={role}
										bind:group={editingUser.role}
										class="sr-only"
									/>
									<div
										class="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2
										{editingUser.role === role ? 'border-amber-500 bg-amber-500' : 'border-muted-foreground/30'}"
									>
										{#if editingUser.role === role}
											<div class="h-1 w-1 rounded-full bg-white"></div>
										{/if}
									</div>
									<span
										class="text-xs font-semibold {editingUser.role === role
											? 'text-amber-600 dark:text-amber-500'
											: 'text-foreground'}"
									>
										{ROLE_LABELS[role]}
									</span>
								</label>
							{/each}
						</div>
					</div>

					{#if editNeedsDept}
						<div class="animate-in space-y-2 duration-300 fade-in slide-in-from-top-2">
							<Label
								for="edit-department"
								class="ml-1 text-xs font-black tracking-widest text-muted-foreground/80 uppercase"
								>{ui.department}</Label
							>
							<div class="group relative">
								<Building2
									size={16}
									class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-amber-500"
								/>
								<select
									id="edit-department"
									bind:value={editingUser.department}
									class="h-12 w-full cursor-pointer appearance-none rounded-2xl border-2 border-border/50 bg-background pr-10 pl-10 text-sm font-semibold transition-colors focus:border-amber-500/50 focus:ring-0 focus:outline-none"
								>
									<option value="" disabled selected>{ui.selectDepartmentPlaceholder}</option>
									{#each VALID_DEPARTMENTS as dept}
										<option value={dept}>{DEPARTMENT_LABELS[dept]}</option>
									{/each}
								</select>
								<ChevronDown
									size={16}
									class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground"
								/>
							</div>
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-4 pt-4">
						<Button
							type="button"
							variant="outline"
							class="h-12 rounded-2xl border-border/40 font-bold"
							onclick={() => (showEditModal = false)}
						>
							{ui.cancel}
						</Button>
						<Button
							type="submit"
							disabled={isUpdatingRole}
							class="h-12 rounded-2xl bg-amber-500 font-bold text-black shadow-lg shadow-amber-500/20 hover:bg-amber-600"
						>
							{#if isUpdatingRole}
								<Loader2 size={18} class="mr-2 animate-spin" /> {ui.processing}
							{:else}
								{ui.update}
							{/if}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	{/if}
</div>
