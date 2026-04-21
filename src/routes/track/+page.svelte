<script lang="ts">
	import {
		Search,
		Clock,
		CheckCircle,
		XCircle,
		AlertTriangle,
		Loader,
		FileSearch,
		ArrowRight,
		CreditCard
	} from 'lucide-svelte';
	import { format, formatDistanceToNow } from 'date-fns';
	import { currentMessages, getDateLocale, locale } from '$lib/i18n';
	import { getDocumentTypeLabel, type DocumentSummary } from '$lib/api/types';

	// ─── Status config ─────────────────────────────────────────────────────────

	const ui = $derived(
		$locale === 'en'
			? {
					statusSteps: [
						{ key: 'RECEIVED', label: 'Received', icon: CheckCircle },
						{ key: 'PROCESSING', label: 'Processing', icon: Loader },
						{ key: 'VALIDATED', label: 'Validated — Pending approval', icon: Clock },
						{ key: 'APPROVED', label: 'Approved', icon: CheckCircle }
					],
					statusDescriptions: {
						RECEIVED: 'The system has received your record and is preparing to process it.',
						ASSIGNED: 'The record has been assigned to the responsible department.',
						PROCESSING: 'The system is processing and analyzing the record.',
						VALIDATED: 'The record has been validated.',
						PENDING_APPROVAL:
							'The record is being reviewed and is waiting for leadership approval.',
						REVISION_REQUESTED: 'The record needs additional information or corrections.',
						APPROVED: 'The record has been approved. Processing is complete.',
						REJECTED:
							'The record does not meet the requirements. Please check your email for the reason.',
						INVALID:
							'The record is invalid or incomplete. Please check your email for follow-up actions.'
					},
					notFound: 'Record not found.',
					citizenMismatch: 'Citizen ID does not match. Please check again.',
					errorLabel: 'Error',
					invalidCode: 'The tracking code is invalid or the record has not been registered yet.',
					trackingPlaceholder: 'e.g. DVC-1736000000000-ABCD1234',
					citizenPlaceholder: 'Citizen ID / National ID (required)',
					active: 'In progress',
					done: 'Completed',
					rejectedTitle: 'Record rejected',
					rejectedHint: 'Check your email for the detailed reason',
					lastUpdated: 'Last updated',
					deadline: 'Processing deadline',
					recordType: 'Record type',
					emptyTitle: 'Enter the tracking code and citizen ID above',
					emptyText:
						'The tracking code is issued after a successful submission. The citizen ID is used to verify the applicant identity.'
				}
			: {
					statusSteps: [
						{ key: 'RECEIVED', label: 'Đã nhận hồ sơ', icon: CheckCircle },
						{ key: 'PROCESSING', label: 'Đang xử lý', icon: Loader },
						{ key: 'VALIDATED', label: 'Hợp lệ — Chờ phê duyệt', icon: Clock },
						{ key: 'APPROVED', label: 'Đã phê duyệt', icon: CheckCircle }
					],
					statusDescriptions: {
						RECEIVED: 'Hệ thống đã nhận được hồ sơ của bạn và đang chuẩn bị xử lý.',
						ASSIGNED: 'Hồ sơ đã được phân công cho Sở/Ngành và đang được thụ lý.',
						PROCESSING: 'Hệ thống đang xử lý và phân tích hồ sơ.',
						VALIDATED: 'Hồ sơ đã được xác nhận hợp lệ.',
						PENDING_APPROVAL: 'Hồ sơ đã được thẩm định và đang trình chờ Lãnh đạo phê duyệt.',
						REVISION_REQUESTED: 'Hồ sơ cần được bổ sung hoặc chỉnh sửa lại nội dung chuyên môn.',
						APPROVED: 'Lãnh đạo đã phê duyệt hồ sơ. Quá trình xử lý đã hoàn tất.',
						REJECTED: 'Hồ sơ không đáp ứng yêu cầu. Vui lòng kiểm tra email để biết lý do.',
						INVALID:
							'Hồ sơ không hơp lệ hoặc thiếu biên bản. Vui lòng kiểm tra email để cung cấp bổ sung.'
					},
					notFound: 'Không tìm thấy hồ sơ.',
					citizenMismatch: 'Số CCCD không khớp. Vui lòng kiểm tra lại.',
					errorLabel: 'Lỗi',
					invalidCode: 'Mã theo dõi không đúng hoặc hồ sơ chưa được đăng ký.',
					trackingPlaceholder: 'VD: DVC-1736000000000-ABCD1234',
					citizenPlaceholder: 'Số CCCD / CMND (bắt buộc)',
					active: 'Đang xử lý',
					done: 'Hoàn thành',
					rejectedTitle: 'Hồ sơ bị từ chối',
					rejectedHint: 'Kiểm tra email để biết lý do chi tiết',
					lastUpdated: 'Cập nhật lần cuối',
					deadline: 'Hạn xử lý',
					recordType: 'Loại hồ sơ',
					emptyTitle: 'Nhập mã theo dõi và Số CCCD ở trên',
					emptyText:
						'Mã theo dõi được cấp sau khi nộp hồ sơ thành công. Số CCCD dùng để xác thực danh tính người nộp hồ sơ.'
				}
	);

	const DOC_TYPE_COLORS: Record<string, string> = {
		CA_NHAN: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
		HO_KINH_DOANH: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
		DOANH_NGHIEP: 'bg-violet-500/10 text-violet-400 border-violet-500/30'
	};

	function getStepIndex(status: string): number {
		if (status === 'REJECTED' || status === 'INVALID') return -1;
		switch (status) {
			case 'RECEIVED':
				return 0;
			case 'ASSIGNED':
				return 1;
			case 'PROCESSING':
				return 1;
			case 'REVISION_REQUESTED':
				return 1;
			case 'VALIDATED':
				return 2;
			case 'PENDING_APPROVAL':
				return 2;
			case 'APPROVED':
				return 4;
			default:
				return -1;
		}
	}

	// ─── State ─────────────────────────────────────────────────────────────────

	let trackingInput = $state('');
	let cccdInput = $state('');
	let submittedCode = $state('');
	let data = $state<DocumentSummary | null>(null);
	let isLoading = $state(false);
	let isRefreshing = $state(false);
	let isError = $state(false);
	let errorMessage = $state('');

	let pollingTimer: ReturnType<typeof setInterval> | null = null;

	// ─── Fetch logic ───────────────────────────────────────────────────────────

	async function fetchStatus(code: string, cccd: string, opts?: { background?: boolean }) {
		const background = opts?.background ?? false;
		if (background) isRefreshing = true;
		else isLoading = true;
		isError = false;
		try {
			const url = `/api/documents/${encodeURIComponent(code)}?cccd=${encodeURIComponent(cccd)}`;
			const res = await fetch(url);
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { message?: string };
				throw new Error(
					body?.message ??
						(res.status === 404
							? ui.notFound
							: res.status === 403
								? ui.citizenMismatch
								: `${ui.errorLabel} ${res.status}`)
				);
			}
			data = await res.json();
			if (pollingTimer) clearInterval(pollingTimer);
			if (data?.status === 'RECEIVED' || data?.status === 'PROCESSING') {
				pollingTimer = setInterval(() => fetchStatus(code, cccd, { background: true }), 5000);
			}
		} catch (e) {
			isError = true;
			errorMessage = e instanceof Error ? e.message : ui.invalidCode;
			// Keep previous `data` during background refresh to avoid UI "reset" flashes.
			// For an explicit user search, clear result to show the error state.
			if (!background) data = null;
		} finally {
			isLoading = false;
			isRefreshing = false;
		}
	}

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		if (!trackingInput.trim() || !cccdInput.trim()) return;
		submittedCode = trackingInput.trim().toUpperCase();
		fetchStatus(submittedCode, cccdInput.trim(), { background: false });
	}

	$effect(() => () => {
		if (pollingTimer) clearInterval(pollingTimer);
	});

	const currentStepIndex = $derived(data ? getStepIndex(data.status) : -1);
	const isRejected = $derived(data?.status === 'REJECTED' || data?.status === 'INVALID');
</script>

<svelte:head>
	<title>{$currentMessages.trackTitle}</title>
	<meta name="description" content={$currentMessages.trackProfileHint} />
</svelte:head>

<div class="mx-auto max-w-2xl animate-in px-4 py-12 duration-700 fade-in">
	<!-- Page header -->
	<div class="mb-10 text-center">
		<div
			class="mb-5 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 backdrop-blur-sm"
		>
			<FileSearch size={16} class="text-primary" />
			<span class="text-xs font-bold tracking-widest text-primary uppercase"
				>{$currentMessages.trackStatus}</span
			>
		</div>
		<h1
			class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
		>
			{$currentMessages.trackProfileTitle}
		</h1>
		<p class="mt-3 text-sm font-medium text-muted-foreground">
			{$currentMessages.trackProfileHint}
		</p>
	</div>

	<!-- Search form -->
	<form onsubmit={handleSearch} class="mb-8 space-y-3">
		<div class="glass-card rounded-2xl border border-border/40 p-2">
			<div class="flex gap-3">
				<div class="relative flex-1">
					<Search
						size={16}
						class="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground/60"
					/>
					<input
						id="tracking-input"
						type="text"
						bind:value={trackingInput}
						placeholder={ui.trackingPlaceholder}
						class="w-full rounded-xl bg-transparent py-3 pr-4 pl-10 font-mono text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground/40
							focus:bg-muted/20"
					/>
				</div>
			</div>
		</div>
		<div class="glass-card rounded-2xl border border-border/40 p-2">
			<div class="flex gap-3">
				<div class="relative flex-1">
					<CreditCard
						size={16}
						class="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground/60"
					/>
					<input
						id="cccd-input"
						type="text"
						maxlength="12"
						bind:value={cccdInput}
						placeholder={ui.citizenPlaceholder}
						class="w-full rounded-xl bg-transparent py-3 pr-4 pl-10 font-mono text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground/40
							focus:bg-muted/20"
					/>
				</div>
				<button
					type="submit"
					disabled={!trackingInput.trim() || !cccdInput.trim() || isLoading}
					class="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/20
						transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40"
				>
					{#if isLoading}
						<Loader size={16} class="animate-spin" />
						{$currentMessages.searching}
					{:else}
						<Search size={16} />
						{$currentMessages.search}
						<ArrowRight size={14} class="opacity-60" />
					{/if}
				</button>
			</div>
		</div>
	</form>

	<!-- Loading skeleton -->
	{#if isLoading && !data}
		<div class="glass-card space-y-4 rounded-2xl border border-border/40 p-8 text-center">
			<div class="flex justify-center">
				<div class="relative">
					<div class="h-14 w-14 animate-pulse rounded-full border-2 border-primary/20"></div>
					<Loader size={24} class="absolute inset-0 m-auto animate-spin text-primary" />
				</div>
			</div>
			<p class="text-sm font-bold tracking-widest text-muted-foreground uppercase">
				{$currentMessages.queryingSystem}
			</p>
		</div>
	{/if}

	<!-- Error state -->
	{#if isError}
		<div
			class="glass-card animate-in rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center duration-300 slide-in-from-top-4"
		>
			<div class="mb-4 flex justify-center">
				<div class="rounded-full border border-destructive/30 bg-destructive/10 p-4">
					<XCircle size={28} class="text-destructive" />
				</div>
			</div>
			<p class="font-extrabold text-foreground">{$currentMessages.profileNotFound}</p>
			<p class="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
		</div>
	{/if}

	<!-- Result card -->
	{#if data}
		<div
			class="glass-card animate-in overflow-hidden rounded-2xl border duration-500 slide-in-from-bottom-4
			{isRejected ? 'border-destructive/20' : 'border-primary/20'}"
		>
			<!-- Header band -->
			<div
				class="relative overflow-hidden px-7 py-6 {isRejected
					? 'bg-destructive/10'
					: 'bg-primary/10'}"
			>
				<div
					class="absolute inset-x-0 top-0 h-0.5 {isRejected
						? 'bg-linear-to-r from-destructive to-red-400'
						: 'bg-linear-to-r from-primary to-purple-500'}"
				></div>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
							{$currentMessages.trackingCode}
						</p>
						<p class="font-mono text-xl font-extrabold tracking-wider text-foreground">
							{data.trackingCode}
						</p>
						<p class="mt-1.5 text-xs font-medium text-muted-foreground">
							{$currentMessages.submittedAt}: {format(
								new Date(data.createdAt),
								"HH:mm 'ngày' dd/MM/yyyy",
								{ locale: getDateLocale($locale) }
							)}
						</p>
					</div>
					<div class="flex items-center gap-2">
						{#if isRefreshing}
							<span
								class="shrink-0 rounded-xl border border-border/30 bg-muted/30 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase"
							>
								{$currentMessages.updating}
							</span>
						{/if}
						<span
							class="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-extrabold tracking-widest uppercase
							{DOC_TYPE_COLORS[data.documentType] ?? 'border-border/30 bg-muted/60 text-muted-foreground'}"
						>
							{getDocumentTypeLabel(data.documentType, $locale) ?? data.documentType}
						</span>
					</div>
				</div>
			</div>

			<div class="space-y-7 p-7">
				<!-- Status description banner -->
				<div
					class="rounded-xl border p-4 {isRejected
						? 'border-destructive/20 bg-destructive/5'
						: data.status === 'APPROVED'
							? 'border-emerald-500/30 bg-emerald-500/10'
							: 'border-primary/20 bg-primary/5'}"
				>
					<p
						class="text-sm font-extrabold {isRejected
							? 'text-destructive'
							: data.status === 'APPROVED'
								? 'text-emerald-500'
								: 'text-primary'}"
					>
						{isRejected
							? `✗ ${ui.rejectedTitle}`
							: (ui.statusSteps[Math.min(currentStepIndex, ui.statusSteps.length - 1)]?.label ??
								data.status)}
					</p>
					<p
						class="mt-1.5 text-sm leading-relaxed font-medium {data.status === 'APPROVED'
							? 'font-bold text-emerald-600/80'
							: 'text-xs text-muted-foreground'}"
					>
						{ui.statusDescriptions[data.status] ?? $currentMessages.updating}
					</p>
				</div>

				<!-- Progress timeline -->
				{#if !isRejected}
					<div class="space-y-4">
						<p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
							{$currentMessages.processingTimeline}
						</p>
						{#each ui.statusSteps as step, index}
							{@const stepDone = index < currentStepIndex}
							{@const stepActive = index === currentStepIndex}
							{@const stepPending = index > currentStepIndex}
							<div class="flex items-center gap-4">
								<!-- Dot/Icon -->
								<div
									class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all
									{stepDone
										? 'border-emerald-400 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
										: stepActive
											? 'animate-pulse border-primary/50 bg-primary/15'
											: 'border-border/30 bg-muted/20'}"
								>
									{#if stepDone}
										<CheckCircle size={16} class="text-white" />
									{:else if stepActive}
										<step.icon size={15} class="text-primary" />
									{:else}
										<step.icon size={15} class="text-muted-foreground/30" />
									{/if}
									<!-- Glow dot for active -->
									{#if stepActive}
										<span
											class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary shadow-[0_0_6px_var(--color-primary)]"
										></span>
									{/if}
								</div>
								<!-- Label -->
								<div class="flex-1">
									<span
										class="text-sm font-bold
										{stepDone ? 'text-emerald-400' : stepActive ? 'text-primary' : 'text-muted-foreground/40'}"
									>
										{step.label}
									</span>
								</div>
								<!-- Active badge -->
								{#if stepActive}
									<span
										class="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-primary uppercase"
									>
										{ui.active}
									</span>
								{:else if stepDone}
									<span
										class="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-400 uppercase"
									>
										{ui.done}
									</span>
								{/if}
							</div>
							<!-- Connector line between steps -->
							{#if index < ui.statusSteps.length - 1}
								<div
									class="ml-[17px] h-4 w-0.5 rounded-full {stepDone
										? 'bg-emerald-500/60'
										: 'bg-border/30'}"
								></div>
							{/if}
						{/each}
					</div>
				{:else}
					<div
						class="flex items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4"
					>
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full border border-destructive/30 bg-destructive/15"
						>
							<XCircle size={18} class="text-destructive" />
						</div>
						<div>
							<p class="font-bold text-destructive">{ui.rejectedTitle}</p>
							<p class="mt-0.5 text-xs text-muted-foreground">{ui.rejectedHint}</p>
						</div>
					</div>
				{/if}

				<!-- Meta grid -->
				<div class="grid grid-cols-2 gap-4 border-t border-border/40 pt-6">
					<div class="space-y-1 rounded-xl border border-border/30 bg-muted/20 p-4">
						<p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
							{ui.lastUpdated}
						</p>
						<p class="text-sm font-bold text-foreground">
							{formatDistanceToNow(new Date(data.updatedAt), {
								addSuffix: true,
								locale: getDateLocale($locale)
							})}
						</p>
					</div>
					{#if data.slaDeadline}
						<div
							class="space-y-1 rounded-xl border p-4
							{new Date(data.slaDeadline) < new Date()
								? 'border-destructive/20 bg-destructive/5'
								: 'border-border/30 bg-muted/20'}"
						>
							<p
								class="text-[10px] font-bold tracking-widest uppercase {new Date(data.slaDeadline) <
								new Date()
									? 'text-destructive'
									: 'text-muted-foreground'}"
							>
								{ui.deadline}
							</p>
							<p
								class="text-sm font-bold {new Date(data.slaDeadline) < new Date()
									? 'text-destructive'
									: 'text-foreground'}"
							>
								{format(new Date(data.slaDeadline), "HH:mm 'ngày' dd/MM/yyyy", {
									locale: getDateLocale($locale)
								})}
							</p>
						</div>
					{:else}
						<div class="space-y-1 rounded-xl border border-border/30 bg-muted/20 p-4">
							<p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
								{ui.recordType}
							</p>
							<p class="text-sm font-bold text-foreground">
								{getDocumentTypeLabel(data.documentType, $locale) ?? data.documentType}
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Empty state hint -->
	{#if !data && !isLoading && !isError}
		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/10 py-16 text-center backdrop-blur-sm"
		>
			<div class="mb-5 rounded-full border border-border/40 bg-muted/20 p-5">
				<FileSearch size={32} class="text-muted-foreground/30" />
			</div>
			<p class="font-bold text-foreground">{ui.emptyTitle}</p>
			<p class="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground/60">
				{ui.emptyText}
			</p>
		</div>
	{/if}
</div>
