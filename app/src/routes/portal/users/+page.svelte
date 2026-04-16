<script lang="ts">
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
		Lock
	} from 'lucide-svelte';
	import { format } from 'date-fns';
	import { vi } from 'date-fns/locale';

	// ─── State ─────────────────────────────────────────────────────────────────
	let users = $state<any[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let showCreateModal = $state(false);

	// Form state for creating user
	let newUser = $state({
		name: '',
		email: '',
		password: '',
		role: 'staff'
	});
	let isCreating = $state(false);
	let createError = $state<string | null>(null);

	// ─── Logic ──────────────────────────────────────────────────────────────────
	async function loadUsers() {
		isLoading = true;
		try {
			// Using Better Auth Admin plugin to list users
			const { data, error } = await authClient.admin.listUsers({
				query: {
					limit: 100
				}
			});
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
		isCreating = true;
		createError = null;
		try {
			const { error } = await authClient.admin.createUser({
				email: newUser.email,
				password: newUser.password,
				name: newUser.name,
				data: {
					role: newUser.role
				}
			});

			if (error) {
				createError = error.message || 'Lỗi không xác định khi tạo tài khoản';
				return;
			}

			// Success
			showCreateModal = false;
			newUser = { name: '', email: '', password: '', role: 'staff' };
			await loadUsers();
		} catch (e) {
			console.error('Create user error:', e);
			createError = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
		} finally {
			isCreating = false;
		}
	}

	$effect(() => {
		loadUsers();
	});

	const filteredUsers = $derived(
		users.filter(
			(u) =>
				u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				u.email.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);
</script>

<svelte:head>
	<title>Quản lý nhân sự — DVC Portal</title>
</svelte:head>

<div class="relative min-h-full p-8">
	<!-- Header Section -->
	<div class="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-foreground bg-linear-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
				Đội ngũ Cán bộ
			</h1>
			<p class="mt-2 text-muted-foreground font-medium">Quản lý tài khoản và phân quyền hệ thống nghiệp vụ</p>
		</div>

		<Button
			onclick={() => (showCreateModal = true)}
			class="h-12 px-6 rounded-2xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all group shrink-0"
		>
			<UserPlus size={18} class="mr-2 group-hover:scale-110 transition-transform" />
			Thêm cán bộ mới
		</Button>
	</div>

	<!-- Stats Quick View (Aesthetic) -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
		<Card class="bg-muted/10 border-border/40 backdrop-blur-sm">
			<CardHeader class="pb-2">
				<CardTitle class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center">
					<UserRound size={12} class="mr-1.5" /> Tổng số nhân sự
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p class="text-3xl font-black text-foreground">{users.length}</p>
			</CardContent>
		</Card>
		<Card class="bg-muted/10 border-border/40 backdrop-blur-sm">
			<CardHeader class="pb-2">
				<CardTitle class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center">
					<ShieldCheck size={12} class="mr-1.5" /> Quản trị viên
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p class="text-3xl font-black text-primary">{users.filter(u => u.role === 'admin').length}</p>
			</CardContent>
		</Card>
		<Card class="bg-muted/10 border-border/40 backdrop-blur-sm overflow-hidden relative">
            <div class="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl"></div>
			<CardHeader class="pb-2">
				<CardTitle class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center">
					<Calendar size={12} class="mr-1.5" /> Hoạt động mới
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p class="text-lg font-bold text-foreground">Hệ thống ổn định</p>
			</CardContent>
		</Card>
	</div>

	<!-- Main Content: User List -->
	<Card class="bg-muted/5 border-border/40 backdrop-blur-md overflow-hidden rounded-3xl group shadow-2xl">
		<CardHeader class="border-b border-border/40 bg-muted/10 px-6 py-5">
			<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<CardTitle class="text-lg font-bold flex items-center">
					<ShieldCheck size={20} class="mr-2 text-primary" />
					Danh mục tài khoản
				</CardTitle>
				<div class="relative w-full md:w-80 group">
					<Search
						size={16}
						class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
					/>
					<Input
						type="text"
						placeholder="Tìm theo tên hoặc email..."
						bind:value={searchQuery}
						class="pl-10 h-10 bg-background/50 border-border/50 rounded-xl focus:ring-primary/20 transition-all"
					/>
				</div>
			</div>
		</CardHeader>
		<CardContent class="p-0">
			{#if isLoading}
				<div class="flex flex-col items-center justify-center py-20 gap-4">
					<Loader2 size={40} class="animate-spin text-primary/50" />
					<p class="text-muted-foreground font-medium animate-pulse">Đang đồng bộ dữ liệu cán bộ...</p>
				</div>
			{:else if filteredUsers.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center">
					<div class="mb-4 rounded-full bg-muted/20 p-6 border border-dashed border-border/40">
						<UserRound size={40} class="text-muted-foreground/30" />
					</div>
					<h3 class="text-lg font-bold text-foreground">Không tìm thấy cán bộ</h3>
					<p class="text-sm text-muted-foreground max-w-xs px-4">
						Thử lại với từ khóa khác hoặc tạo tài khoản mới ngay bây giờ.
					</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 border-b border-border/40 bg-muted/5">
								<th class="px-6 py-4">Thanh danh cán bộ</th>
								<th class="px-6 py-4">Định danh (Email)</th>
								<th class="px-6 py-4">Vai trò</th>
								<th class="px-6 py-4">Ngày khởi tạo</th>
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
										<Badge variant={user.role === 'admin' ? 'default' : 'secondary'} class="rounded-lg px-2.5 py-0.5 font-bold uppercase text-[9px] tracking-wider transition-all">
											{user.role === 'admin' ? 'Quản trị viên' : 'Chuyên viên'}
										</Badge>
									</td>
									<td class="px-6 py-4 text-xs text-muted-foreground/80 font-mono">
										{format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
									</td>
									<td class="px-6 py-4 text-right">
                                        <Button variant="ghost" size="sm" class="rounded-lg h-8 w-8 p-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                            <Lock size={14} />
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
			<!-- Backdrop -->
			<div
				class="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300"
				onclick={() => (showCreateModal = false)}
			></div>

			<!-- Modal Content -->
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
						Cấp phát định danh mới cho chuyên viên vào hệ thống nghiệp vụ DVC.
					</CardDescription>
				</CardHeader>

				<form onsubmit={handleCreateUser} class="p-6 pt-0 space-y-5">
					{#if createError}
						<div class="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-bold flex items-center gap-2">
							<X size={14} /> {createError}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="name" class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Họ và Tên</Label>
						<Input
							id="name"
							placeholder="VD: Nguyễn Văn A"
							bind:value={newUser.name}
							required
							class="h-12 rounded-2xl bg-muted/30 border-border/40"
						/>
					</div>

					<div class="space-y-2">
						<Label for="email" class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Địa chỉ Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="example@dvc.gov.vn"
							bind:value={newUser.email}
							required
							class="h-12 rounded-2xl bg-muted/30 border-border/40"
						/>
					</div>

					<div class="space-y-2">
						<Label for="password" class="text-xs font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Mật khẩu khởi tạo</Label>
						<Input
							id="password"
							type="password"
							placeholder="••••••••"
							bind:value={newUser.password}
							required
							minlength={8}
							class="h-12 rounded-2xl bg-muted/30 border-border/40"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4 pt-4">
						<Button
							type="button"
							variant="outline"
							class="h-12 rounded-2xl font-bold border-border/40"
							onclick={() => (showCreateModal = false)}
						>
							Hủy bỏ
						</Button>
						<Button
							type="submit"
							disabled={isCreating}
							class="h-12 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 flex items-center justify-center"
						>
							{#if isCreating}
								<Loader2 size={18} class="mr-2 animate-spin" />
								Đang khởi tạo...
							{:else}
								Xác nhận cấp phát
							{/if}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background-attachment: fixed;
	}
</style>
