<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle, BrainCircuit } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { authClient } from '$lib/auth-client';

	// ─── State ────────────────────────────────────────────────────────────────

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isLoading = $state(false);
	let errorMsg = $state('');

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/portal');

	// ─── Submit ───────────────────────────────────────────────────────────────

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
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

	const DEMO_EMAIL = 'admin@dvc.gov.vn';
	const DEMO_PASSWORD = 'Admin@DVC2025!';
	let filled = $state(false);

	function fillDemo() {
		email = DEMO_EMAIL;
		password = DEMO_PASSWORD;
		filled = true;
		setTimeout(() => filled = false, 1500);
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
				<Button
					type="submit"
					size="lg"
					disabled={isLoading || !email || !password}
					class="w-full h-13 text-[15px] font-extrabold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 rounded-xl transition-all active:scale-[0.98]"
				>
					{#if isLoading}
						<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
						Đang xác thực...
					{:else}
						<ShieldCheck size={18} class="mr-2" />
						Truy cập hệ thống
					{/if}
				</Button>
			</form>

			<!-- Demo credentials hint -->
			<div class="mt-8 border-t border-border/40 pt-6">
				<p class="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Tài khoản mẫu cho demo</p>
				<button
					type="button"
					onclick={fillDemo}
					class="w-full rounded-xl border font-mono text-xs transition-all duration-200 active:scale-[0.98]
						{filled
							? 'border-emerald-500/40 bg-emerald-500/10 shadow-sm shadow-emerald-500/10'
							: 'border-border/30 bg-muted/20 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/10'}"
				>
					<div class="p-4 space-y-1.5">
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground">Email:</span>
							<span class="{filled ? 'text-emerald-500' : 'text-primary'} font-bold transition-colors">{DEMO_EMAIL}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground">Mật khẩu:</span>
							<span class="{filled ? 'text-emerald-500' : 'text-primary'} font-bold transition-colors">{DEMO_PASSWORD}</span>
						</div>
						<p class="text-center text-muted-foreground/50 text-[10px] pt-1 uppercase tracking-widest">
							{filled ? '✓ Đã điền thông tin' : '↑ Bấm để tự động điền'}
						</p>
					</div>
				</button>
			</div>
		</div>

		<p class="mt-6 text-center text-xs text-muted-foreground/50 uppercase tracking-widest">
			<a href="/" class="hover:text-muted-foreground transition-colors">← Về trang chủ DVC</a>
		</p>
	</div>
</div>
