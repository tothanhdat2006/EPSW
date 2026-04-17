<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle, BrainCircuit } from 'lucide-svelte';
	import { authClient } from '$lib/auth-client';

	// ─── State ────────────────────────────────────────────────────────────────

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isLoading = $state(false);
	let errorMsg = $state('');

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/portal');
	const canSubmit = $derived(!isLoading && email.length > 0 && password.length > 0);

	// ─── Submit ───────────────────────────────────────────────────────────────

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		isLoading = true;
		errorMsg = '';

		const result = await authClient.signIn.email({
			email,
			password,
			fetchOptions: { onError: (ctx) => { errorMsg = ctx.error.message ?? 'Đăng nhập thất bại.'; } }
		});

		if (!result.error) {
			await goto(redirectTo, { replaceState: true, invalidateAll: true });
		}

		isLoading = false;
	}

	const DEMO_ACCOUNTS = [
		{ role: 'Admin', email: 'admin@dvc.gov.vn', dept: 'Quản trị hệ thống' },
		{ role: 'Bộ phận Một cửa', email: 'motcua@dvc.gov.vn', dept: 'Tiếp nhận HS' },
		{ role: 'Chuyên viên Sở', email: 'chuyenvien@dvc.gov.vn', dept: 'Sở Kế hoạch & Đầu tư' },
		{ role: 'Lãnh đạo', email: 'lanhdao@dvc.gov.vn', dept: 'Sở Kế hoạch & Đầu tư' },
	];
	const DEMO_PASSWORD = 'Admin@DVC2025!';
	let filledIndex = $state<number | null>(null);

	function fillDemo(index: number) {
		email = DEMO_ACCOUNTS[index].email;
		password = DEMO_PASSWORD;
		filledIndex = index;
		setTimeout(() => filledIndex = null, 1500);
	}
</script>

<svelte:head>
	<title>Đăng nhập Cán bộ — DVC Admin</title>
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
	<!-- Background glows -->
	<div class="pointer-events-none absolute inset-0">
		<div class="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]"></div>
		<div class="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[120px]"></div>
	</div>

	<div class="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
		<!-- Header -->
		<div class="mb-10 text-center">
			<div class="inline-flex items-center gap-2 mb-6 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-2.5 backdrop-blur-sm">
				<ShieldCheck size={18} class="text-primary" />
				<span class="text-sm font-bold tracking-widest text-primary uppercase">Khu vực Cán bộ</span>
			</div>
			<div class="flex items-center justify-center gap-3 mb-4">
				<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-600 shadow-xl shadow-primary/20">
					<BrainCircuit size={28} class="text-white" />
				</div>
			</div>
			<h1 class="text-3xl font-extrabold tracking-tight text-foreground">DVC Admin Portal</h1>
			<p class="mt-2 text-sm font-medium text-muted-foreground">Đăng nhập để truy cập hệ thống quản trị</p>
		</div>

		<!-- Login Card -->
		<div class="glass-card rounded-2xl border border-border/40 p-8 shadow-2xl">
			<!-- Top accent line -->
			<div class="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-linear-to-r from-primary to-purple-500 opacity-80"></div>

			<form onsubmit={handleLogin} class="space-y-6">
				<!-- Email -->
				<div class="space-y-2">
					<label for="email" class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
						<Mail size={13} class="text-primary" /> Địa chỉ Email
					</label>
					<div class="relative">
						<input
							id="email"
							type="email"
							bind:value={email}
							required
							placeholder="admin@dvc.gov.vn"
							autocomplete="email"
							class="w-full rounded-xl border border-border/50 bg-background/80 px-4 py-3 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all outline-none
								focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:bg-background"
						/>
					</div>
				</div>

				<!-- Password -->
				<div class="space-y-2">
					<label for="password" class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
						<Lock size={13} class="text-primary" /> Mật khẩu
					</label>
					<div class="relative">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							required
							placeholder="••••••••"
							autocomplete="current-password"
							class="w-full rounded-xl border border-border/50 bg-background/80 px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all outline-none
								focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:bg-background"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
						>
							{#if showPassword}
								<EyeOff size={16} />
							{:else}
								<Eye size={16} />
							{/if}
						</button>
					</div>
				</div>

				<!-- Error -->
				{#if errorMsg}
					<div class="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 animate-in slide-in-from-top-2 duration-300">
						<AlertCircle size={16} class="shrink-0 text-destructive" />
						<p class="text-[13px] font-semibold text-destructive">{errorMsg}</p>
					</div>
				{/if}

				<!-- Submit -->
				<button
					type="submit"
					disabled={!canSubmit}
					class="w-full h-13 flex items-center justify-center gap-2 text-[15px] font-extrabold rounded-xl transition-all active:scale-[0.98]
						{canSubmit
							? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 cursor-pointer'
							: 'bg-primary/40 text-primary-foreground/50 cursor-not-allowed'}"
				>
					{#if isLoading}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
						Đang xác thực...
					{:else}
						<ShieldCheck size={18} />
						Truy cập hệ thống
					{/if}
				</button>
			</form>

			<!-- Demo credentials hint -->
			<div class="mt-8 border-t border-border/40 pt-6">
				<p class="text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4">Tài khoản trải nghiệm nhanh</p>
				<div class="grid grid-cols-2 gap-3">
					{#each DEMO_ACCOUNTS as acc, i}
						<button
							type="button"
							onclick={() => fillDemo(i)}
							class="text-left rounded-xl border p-3 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20
								{filledIndex === i
									? 'border-emerald-500 bg-emerald-500/10 shadow-sm shadow-emerald-500/20'
									: 'border-border/30 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/10'}"
						>
							<div class="flex flex-col gap-1">
								<span class="text-[11px] font-black {filledIndex === i ? 'text-emerald-500' : 'text-foreground'}">{acc.role}</span>
								<span class="text-[10px] text-muted-foreground truncate">{acc.dept}</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<p class="mt-6 text-center text-xs text-muted-foreground/50 uppercase tracking-widest">
			<a href="/" class="hover:text-muted-foreground transition-colors">← Về trang chủ DVC</a>
		</p>
	</div>
</div>
