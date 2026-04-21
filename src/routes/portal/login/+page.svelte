<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle, BrainCircuit } from 'lucide-svelte';
	import { authClient } from '$lib/auth-client';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import TestAccountsPanel from '$lib/components/TestAccountsPanel.svelte';
	import type { SeedTestAccount } from '$lib/constants/seed-test-accounts';
	import { currentMessages } from '$lib/i18n';

	// ─── State ────────────────────────────────────────────────────────────────

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isLoading = $state(false);
	let errorMsg = $state('');
	let filledTestEmail = $state<string | null>(null);

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/portal');
	const canSubmit = $derived(!isLoading && email.length > 0 && password.length > 0);

	async function loginWithCredentials(nextEmail: string, nextPassword: string) {
		isLoading = true;
		errorMsg = '';

		const result = await authClient.signIn.email({
			email: nextEmail,
			password: nextPassword,
			fetchOptions: {
				onError: (ctx) => {
					errorMsg = ctx.error.message ?? $currentMessages.loginFailed;
				}
			}
		});

		if (!result.error) {
			await goto(redirectTo, { replaceState: true, invalidateAll: true });
		}

		isLoading = false;
	}

	// ─── Submit ───────────────────────────────────────────────────────────────

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		await loginWithCredentials(email, password);
	}

	function handleSeedFill(account: SeedTestAccount) {
		email = account.email;
		password = account.password;
		errorMsg = '';
		filledTestEmail = account.email;
		setTimeout(() => {
			if (filledTestEmail === account.email) filledTestEmail = null;
		}, 1500);
	}
</script>

<svelte:head>
	<title>{$currentMessages.loginTitle}</title>
</svelte:head>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8"
>
	<!-- Background glows -->
	<div class="pointer-events-none absolute inset-0">
		<div
			class="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]"
		></div>
		<div
			class="absolute -right-32 -bottom-32 h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[120px]"
		></div>
	</div>

	<div
		class="relative z-10 w-full max-w-6xl animate-in duration-700 fade-in slide-in-from-bottom-4"
	>
		<div class="grid gap-8 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-center">
			<div>
				<div class="mb-10 text-center lg:text-left">
					<div
						class="mb-6 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-2.5 backdrop-blur-sm"
					>
						<ShieldCheck size={18} class="text-primary" />
						<span class="text-sm font-bold tracking-widest text-primary uppercase"
							>{$currentMessages.portalArea}</span
						>
					</div>
					<div class="mb-4 flex items-center justify-center gap-3 lg:justify-start">
						<div
							class="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-600 shadow-xl shadow-primary/20"
						>
							<BrainCircuit size={28} class="text-white" />
						</div>
					</div>
					<h1 class="text-3xl font-extrabold tracking-tight text-foreground">
						{$currentMessages.staffPortalTitle}
					</h1>
					<p class="mt-2 text-sm font-medium text-muted-foreground">
						{$currentMessages.staffPortalSubtitle}
					</p>
				</div>

				<div class="mb-4 flex justify-center lg:justify-start">
					<LocaleSwitcher />
				</div>

				<div class="glass-card relative rounded-2xl border border-border/40 p-8 shadow-2xl">
					<div
						class="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-linear-to-r from-primary to-purple-500 opacity-80"
					></div>

					<form onsubmit={handleLogin} class="space-y-6">
						<div class="space-y-2">
							<label
								for="email"
								class="flex items-center gap-2 text-xs font-extrabold tracking-widest text-muted-foreground uppercase"
							>
								<Mail size={13} class="text-primary" />
								{$currentMessages.emailAddress}
							</label>
							<div class="relative">
								<input
									id="email"
									type="email"
									bind:value={email}
									required
									placeholder="admin@dvc.gov.vn"
									autocomplete="email"
									class="w-full rounded-xl border border-border/50 bg-background/80 px-4 py-3 pr-4 text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
								/>
							</div>
						</div>

						<div class="space-y-2">
							<label
								for="password"
								class="flex items-center gap-2 text-xs font-extrabold tracking-widest text-muted-foreground uppercase"
							>
								<Lock size={13} class="text-primary" />
								{$currentMessages.password}
							</label>
							<div class="relative">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									bind:value={password}
									required
									placeholder="••••••••"
									autocomplete="current-password"
									class="w-full rounded-xl border border-border/50 bg-background/80 px-4 py-3 pr-12 text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute top-1/2 right-3 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
								>
									{#if showPassword}
										<EyeOff size={16} />
									{:else}
										<Eye size={16} />
									{/if}
								</button>
							</div>
						</div>

						{#if errorMsg}
							<div
								class="flex animate-in items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 duration-300 slide-in-from-top-2"
							>
								<AlertCircle size={16} class="shrink-0 text-destructive" />
								<p class="text-[13px] font-semibold text-destructive">{errorMsg}</p>
							</div>
						{/if}

						<button
							type="submit"
							disabled={!canSubmit}
							class="flex h-13 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-extrabold transition-all active:scale-[0.98]
								{canSubmit
								? 'cursor-pointer bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90'
								: 'cursor-not-allowed bg-primary/40 text-primary-foreground/50'}"
						>
							{#if isLoading}
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
								></span>
								{$currentMessages.authenticating}
							{:else}
								<ShieldCheck size={18} />
								{$currentMessages.accessSystem}
							{/if}
						</button>
					</form>
				</div>

				<p
					class="mt-6 text-center text-xs tracking-widest text-muted-foreground/50 uppercase lg:text-left"
				>
					<a href="/" class="transition-colors hover:text-muted-foreground"
						>{$currentMessages.backToHome}</a
					>
				</p>
			</div>

			<TestAccountsPanel
				onFill={handleSeedFill}
				activeEmail={filledTestEmail}
				disabled={isLoading}
			/>
		</div>
	</div>
</div>
