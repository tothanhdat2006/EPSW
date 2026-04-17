<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Card, CardContent, CardDescription, CardHeader, CardTitle
	} from '$lib/components/ui/card/index.js';
	import {
		UserPlus, Search, ShieldCheck, Mail, Calendar,
		UserRound, Loader2, X, Lock, Building2, Inbox, ChevronDown, Pencil
	} from 'lucide-svelte';
	import { format } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import {
		ROLE_LABELS, DEPARTMENT_LABELS, VALID_ROLES, VALID_DEPARTMENTS,
		ROLES_WITH_DEPARTMENT, type StaffRole, type Department
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

	let editNeedsDept = $derived(editingUser ? ROLES_WITH_DEPARTMENT.includes(editingUser.role) : false);

	function openEditModal(user: any) {
		editingUser = { ...user };
		if (!editingUser.department) editingUser.department = '';
		showEditModal = true;
	}

	async function handleUpdateRole(e: SubmitEvent) {
		e.preventDefault();
		if (!editingUser) return;
		
		if (editNeedsDept && !editingUser.department) {
			updateError = 'Vui lòng chọn đơn vị phụ trách.';
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
			updateError = e.message || 'Đã xảy ra lỗi hệ thống.';
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
			createError = 'Vui lòng chọn đơn vị phụ trách.';
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
				createError = error.message || 'Lỗi không xác định khi tạo tài khoản';
				return;
			}
			showCreateModal = false;
			newUser = { name: '', email: '', password: '', role: 'mot_cua', department: '' };
			await loadUsers();
		} catch (e) {
			createError = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
		} finally {
			isCreating = false;
		}
	}

	onMount(() => { loadUsers(); });

	const filteredUsers = $derived(
		users.filter(u => {
			const matchSearch =
				u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				u.email.toLowerCase().includes(searchQuery.toLowerCase());
			const matchRole = !filterRole || u.role === filterRole;
			return matchSearch && matchRole;
		})
	);

	function getRoleBadgeClass(role: string) {
		const map: Record<string, string> = {
			admin:       'bg-violet-500/10 text-violet-400 border border-violet-500/20',
			mot_cua:     'bg-blue-500/10 text-blue-400 border border-blue-500/20',
			chuyen_vien: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
			lanh_dao:    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
		};
		return map[role] ?? 'bg-muted/20 text-muted-foreground border border-border/30';
	}
</script>

<svelte:head>
	<title>Quản lý nhân sự — DVC Portal</title>
</svelte:head>

<div class="relative min-h-full p-8">
	<!-- Header -->
	<div class="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-foreground">Đội ngũ Cán bộ</h1>
			<p class="mt-2 text-muted-foreground font-medium">Quản lý tài khoản và phân quyền nghiệp vụ theo vai trò</p>
		</div>
		<Button
			onclick={() => (showCreateModal = true)}
			class="h-12 px-6 rounded-2xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all group shrink-0"
		>
			<UserPlus size={18} class="mr-2 group-hover:scale-110 transition-transform" />
			Thêm cán bộ mới
		</Button>
	</div>

	<!-- Role stats -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
		{#each VALID_ROLES as role}
			<button
				onclick={() => filterRole = filterRole === role ? '' : role}
				class="rounded-2xl border p-4 text-left transition-all
					{filterRole === role ? 'border-primary bg-primary/5' : 'border-border/40 bg-muted/10 hover:border-border/60'}"
			>
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{ROLE_LABELS[role]}</p>
				<p class="text-2xl font-black text-foreground mt-1">{users.filter(u => u.role === role).length}</p>
			</button>
		{/each}
	</div>

	<!-- User table -->
	<Card class="bg-muted/5 border-border/40 backdrop-blur-md overflow-hidden rounded-3xl shadow-2xl">
		<CardHeader class="border-b border-border/40 bg-muted/10 px-6 py-5">
			<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<CardTitle class="text-lg font-bold flex items-center">
					<ShieldCheck size={20} class="mr-2 text-primary" />
					Danh mục tài khoản {filterRole ? `— ${ROLE_LABELS[filterRole as StaffRole]}` : ''}
				</CardTitle>
				<div class="relative w-full md:w-80 group">
					<Search size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
					<Input
						type="text"
						placeholder="Tìm theo tên hoặc email..."
						bind:value={searchQuery}
						class="pl-10 h-10 bg-background/50 border-border/50 rounded-xl"
					/>
				</div>
			</div>
		</CardHeader>
		<CardContent class="p-0">
			{#if isLoading}
				<div class="flex flex-col items-center justify-center py-20 gap-4">
					<Loader2 size={40} class="animate-spin text-primary/50" />
					<p class="text-muted-foreground font-medium animate-pulse">Đang tải danh sách cán bộ...</p>
				</div>
			{:else if filteredUsers.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center">
					<div class="mb-4 rounded-full bg-muted/20 p-6 border border-dashed border-border/40">
						<UserRound size={40} class="text-muted-foreground/30" />
					</div>
					<h3 class="text-lg font-bold text-foreground">Không tìm thấy cán bộ</h3>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 border-b border-border/40 bg-muted/5">
								<th class="px-6 py-4">Họ và Tên</th>
								<th class="px-6 py-4">Email</th>
								<th class="px-6 py-4">Vai trò</th>
								<th class="px-6 py-4">Đơn vị</th>
								<th class="px-6 py-4">Ngày tạo</th>
								<th class="px-6 py-4 text-right">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/20">
							{#each filteredUsers as user}
								<tr class="hover:bg-primary/5 transition-colors group/row">
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<div class="h-10 w-10 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-sm group-hover/row:scale-105 transition-transform">
												{user.name?.charAt(0).toUpperCase() || 'U'}
											</div>
											<span class="font-bold text-foreground tracking-tight">{user.name}</span>
										</div>
									</td>
									<td class="px-6 py-4">
										<div class="flex items-center gap-2 text-muted-foreground font-medium">
											<Mail size={14} class="opacity-50" />
											{user.email}
										</div>
									</td>
									<td class="px-6 py-4">
										<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold {getRoleBadgeClass(user.role)}">
											{ROLE_LABELS[user.role as StaffRole] ?? user.role}
										</span>
									</td>
									<td class="px-6 py-4">
										{#if user.department}
											<div class="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
												<Building2 size={12} class="opacity-60" />
												{DEPARTMENT_LABELS[user.department as Department] ?? user.department}
											</div>
										{:else}
											<span class="text-[11px] text-muted-foreground/40">—</span>
										{/if}
									</td>
									<td class="px-6 py-4 text-xs text-muted-foreground/80 font-mono">
										{format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
									</td>
									<td class="px-6 py-4 text-right">
										<Button variant="ghost" size="sm" onclick={() => openEditModal(user)} class="rounded-lg h-8 w-8 p-0 opacity-0 group-hover/row:opacity-100 transition-opacity text-primary hover:bg-primary/10">
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
			<div
				class="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300"
				onclick={() => (showCreateModal = false)}
			></div>

			<Card class="relative w-full max-w-lg bg-card/95 border-border shadow-2xl rounded-[2rem] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
				<div class="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary"></div>
				<CardHeader class="pb-4">
					<div class="flex items-center justify-between">
						<CardTitle class="text-2xl font-black">Khởi tạo Cán bộ mới</CardTitle>
						<Button variant="ghost" size="icon" class="rounded-full h-8 w-8" onclick={() => (showCreateModal = false)}>
							<X size={18} />
						</Button>
					</div>
					<CardDescription class="text-muted-foreground font-medium">
						Cấp phát định danh mới cho cán bộ vào hệ thống nghiệp vụ DVC.
					</CardDescription>
				</CardHeader>

				<form onsubmit={handleCreateUser} class="p-6 pt-0 space-y-4">
					{#if createError}
						<div class="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-bold flex items-center gap-2">
							<X size={14} /> {createError}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="name" class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Họ và Tên</Label>
						<Input id="name" placeholder="VD: Nguyễn Văn A" bind:value={newUser.name} required class="h-12 rounded-2xl bg-muted/30 border-border/40" />
					</div>

					<div class="space-y-2">
						<Label for="email" class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Địa chỉ Email</Label>
						<Input id="email" type="email" placeholder="example@dvc.gov.vn" bind:value={newUser.email} required class="h-12 rounded-2xl bg-muted/30 border-border/40" />
					</div>

					<div class="space-y-2">
						<Label for="password" class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Mật khẩu khởi tạo</Label>
						<Input id="password" type="password" placeholder="••••••••" bind:value={newUser.password} required minlength={8} class="h-12 rounded-2xl bg-muted/30 border-border/40" />
					</div>

					<!-- Role selection -->
					<div class="space-y-2">
						<Label class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Vai trò</Label>
						<div class="grid grid-cols-2 gap-2">
							{#each VALID_ROLES as role}
								<label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 transition-all
									{newUser.role === role ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-primary/30'}">
									<input type="radio" name="role" value={role} bind:group={newUser.role} class="sr-only" />
									<div class="w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center
										{newUser.role === role ? 'border-primary bg-primary' : 'border-muted-foreground/30'}">
										{#if newUser.role === role}
											<div class="w-1 h-1 rounded-full bg-white"></div>
										{/if}
									</div>
									<span class="text-xs font-semibold {newUser.role === role ? 'text-primary' : 'text-foreground'}">
										{ROLE_LABELS[role]}
									</span>
								</label>
							{/each}
						</div>
					</div>

					<!-- Department (conditional) -->
					{#if needsDept}
						<div class="space-y-2 animate-in slide-in-from-top-2 duration-200">
							<Label class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">
								Đơn vị phụ trách <span class="text-destructive">*</span>
							</Label>
							<div class="relative">
								<Building2 size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
								<select
									bind:value={newUser.department}
									class="w-full h-12 rounded-2xl bg-muted/30 border border-border/40 pl-10 pr-4 text-sm font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
								>
									<option value="">— Chọn đơn vị —</option>
									{#each VALID_DEPARTMENTS as dept}
										<option value={dept}>{DEPARTMENT_LABELS[dept]}</option>
									{/each}
								</select>
								<ChevronDown size={14} class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
							</div>
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-4 pt-2">
						<Button type="button" variant="outline" class="h-12 rounded-2xl font-bold border-border/40" onclick={() => (showCreateModal = false)}>
							Hủy bỏ
						</Button>
						<Button
							type="submit"
							disabled={isCreating}
							class="h-12 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20"
						>
							{#if isCreating}
								<Loader2 size={18} class="mr-2 animate-spin" /> Đang khởi tạo...
							{:else}
								Xác nhận cấp phát
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
			<div
				class="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300"
				onclick={() => (showEditModal = false)}
			></div>

			<Card class="relative w-full max-w-lg bg-card/95 border-border shadow-2xl rounded-[2rem] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
				<div class="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-amber-500 to-amber-300"></div>
				<CardHeader class="pb-4">
					<div class="flex items-center justify-between">
						<CardTitle class="text-2xl font-black">Cập nhật Vai trò</CardTitle>
						<Button variant="ghost" size="icon" class="rounded-full h-8 w-8" onclick={() => (showEditModal = false)}>
							<X size={18} />
						</Button>
					</div>
					<CardDescription class="text-muted-foreground font-medium">
						Thay đổi phân quyền nghiệp vụ cho <span class="font-bold text-foreground">{editingUser.name}</span>.
					</CardDescription>
				</CardHeader>

				<form onsubmit={handleUpdateRole} class="p-6 pt-0 space-y-4">
					{#if updateError}
						<div class="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-bold flex items-center gap-2">
							<X size={14} /> {updateError}
						</div>
					{/if}

					<!-- Role selection -->
					<div class="space-y-2">
						<Label class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Vai trò mới</Label>
						<div class="grid grid-cols-2 gap-2">
							{#each VALID_ROLES as role}
								<label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 transition-all
									{editingUser.role === role ? 'border-amber-500 bg-amber-500/5' : 'border-border/30 hover:border-amber-500/30'}">
									<input type="radio" name="editRole" value={role} bind:group={editingUser.role} class="sr-only" />
									<div class="w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center
										{editingUser.role === role ? 'border-amber-500 bg-amber-500' : 'border-muted-foreground/30'}">
										{#if editingUser.role === role}
											<div class="w-1 h-1 rounded-full bg-white"></div>
										{/if}
									</div>
									<span class="text-xs font-semibold {editingUser.role === role ? 'text-amber-600 dark:text-amber-500' : 'text-foreground'}">
										{ROLE_LABELS[role]}
									</span>
								</label>
							{/each}
						</div>
					</div>

					{#if editNeedsDept}
						<div class="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
							<Label for="edit-department" class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Đơn vị phụ trách</Label>
							<div class="relative group">
								<Building2 size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-amber-500 transition-colors pointer-events-none" />
								<select
									id="edit-department"
									bind:value={editingUser.department}
									class="w-full h-12 pl-10 pr-10 appearance-none bg-background border-2 border-border/50 rounded-2xl focus:outline-none focus:ring-0 focus:border-amber-500/50 transition-colors cursor-pointer text-sm font-semibold"
								>
									<option value="" disabled selected>Chọn đơn vị phụ trách...</option>
									{#each VALID_DEPARTMENTS as dept}
										<option value={dept}>{DEPARTMENT_LABELS[dept]}</option>
									{/each}
								</select>
								<ChevronDown size={16} class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
							</div>
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-4 pt-4">
						<Button type="button" variant="outline" class="h-12 rounded-2xl font-bold border-border/40" onclick={() => (showEditModal = false)}>
							Hủy bỏ
						</Button>
						<Button
							type="submit"
							disabled={isUpdatingRole}
							class="h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-lg shadow-amber-500/20"
						>
							{#if isUpdatingRole}
								<Loader2 size={18} class="mr-2 animate-spin" /> Xử lý...
							{:else}
								Cập nhật
							{/if}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	{/if}
</div>
