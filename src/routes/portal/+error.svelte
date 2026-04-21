<script lang="ts">
	import { page } from '$app/state';
	import { AlertTriangle, Home, LogOut } from 'lucide-svelte';
	import { authClient } from '$lib/auth-client';
	import { currentMessages } from '$lib/i18n';

	async function logout() {
		await authClient.signOut();
		window.location.href = '/portal/login';
	}
</script>

<svelte:head>
	<title>{page.status} {$currentMessages.notFoundProfile} — DVC Admin</title>
</svelte:head>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4"
>
	<!-- Background glows -->
	<div class="pointer-events-none absolute inset-0">
		<div
			class="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-destructive/10 blur-[120px]"
		></div>
		<div
			class="absolute -right-32 -bottom-32 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[100px]"
		></div>
	</div>

	<div class="relative z-10 w-full max-w-lg animate-in duration-500 zoom-in-95 fade-in">
		<div
			class="glass-card relative overflow-hidden rounded-3xl border border-border/40 p-10 text-center shadow-2xl"
		>
			<!-- Top accent line -->
			<div
				class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-destructive/50 via-destructive to-destructive/50"
			></div>

			<div class="mb-6 flex justify-center">
				<div class="relative rounded-full border border-destructive/20 bg-destructive/10 p-4">
					<AlertTriangle size={48} class="text-destructive drop-shadow-md" />
				</div>
			</div>

			<h1 class="mb-4 text-6xl font-black tracking-tighter text-foreground">
				{page.status}
			</h1>

			<div class="mb-8 space-y-2">
				<h2 class="text-xl font-bold text-foreground">
					{$currentMessages.notFoundProfile}
				</h2>
				<p class="mx-auto max-w-sm text-sm font-medium text-muted-foreground/80">
					{page.error?.message || $currentMessages.notFoundProfileHint}
				</p>
			</div>

			<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
				<a
					href="/portal"
					class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 sm:w-auto"
				>
					<Home size={18} />
					{$currentMessages.backToDashboard}
				</a>

				<button
					onclick={logout}
					class="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-6 font-bold text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground active:scale-95 sm:w-auto"
				>
					<LogOut size={18} />
					{$currentMessages.signOut}
				</button>
			</div>
		</div>

		<p
			class="mt-8 text-center text-xs font-black tracking-widest text-muted-foreground/40 uppercase"
		>
			DVC platform © 2026
		</p>
	</div>
</div>
