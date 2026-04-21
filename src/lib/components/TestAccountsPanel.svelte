<script lang="ts">
	import { Check, LaptopMinimalCheck, LogIn } from 'lucide-svelte';
	import { getDepartmentLabel, getRoleLabel } from '$lib/api/types';
	import { type SeedTestAccount, SEED_TEST_ACCOUNTS } from '$lib/constants/seed-test-accounts';
	import { currentMessages, locale } from '$lib/i18n';

	type Props = {
		onFill: (account: SeedTestAccount) => void;
		activeEmail?: string | null;
		disabled?: boolean;
	};

	let { onFill, activeEmail = null, disabled = false }: Props = $props();
</script>

<section class="glass-card rounded-2xl border border-border/40 p-6 shadow-2xl">
	<div class="mb-6 flex items-start gap-4">
		<div
			class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
		>
			<LaptopMinimalCheck size={22} />
		</div>
		<div class="space-y-1">
			<p class="text-xs font-black tracking-[0.22em] text-primary/80 uppercase">
				{$currentMessages.testAccounts}
			</p>
			<h2 class="text-xl font-extrabold tracking-tight text-foreground">
				{$currentMessages.quickFillQaAccounts}
			</h2>
			<p class="text-sm text-muted-foreground">
				{$currentMessages.testAccountHint}
			</p>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each SEED_TEST_ACCOUNTS as account}
			<button
				type="button"
				{disabled}
				onclick={() => onFill(account)}
				class="group w-full rounded-2xl border border-border/40 bg-background/60 p-4 text-left transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 {activeEmail ===
				account.email
					? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
					: ''}"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 space-y-1.5">
						<div class="flex items-center gap-2">
							<span
								class="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black tracking-[0.18em] text-primary uppercase"
							>
								{getRoleLabel(account.role, $locale)}
							</span>
							{#if account.department}
								<span class="text-[11px] font-semibold text-muted-foreground">
									{getDepartmentLabel(account.department, $locale)}
								</span>
							{/if}
						</div>

						<div>
							<p class="truncate text-sm font-bold text-foreground">{account.name}</p>
							<p class="truncate text-xs text-muted-foreground">{account.email}</p>
						</div>
					</div>

					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/80 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary {activeEmail ===
						account.email
							? 'border-emerald-500/40 text-emerald-600'
							: ''}"
					>
						{#if activeEmail === account.email}
							<Check size={16} />
						{:else}
							<LogIn size={16} />
						{/if}
					</div>
				</div>
			</button>
		{/each}
	</div>

	<div class="mt-5 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-3">
		<p class="text-xs font-semibold text-muted-foreground">
			{$currentMessages.sharedSeedPassword}
			<span class="font-black tracking-wide text-foreground">Admin@DVC2025!</span>
		</p>
	</div>
</section>
