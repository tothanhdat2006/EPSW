<script lang="ts">
	import { Search, Clock, CheckCircle, XCircle, AlertTriangle, Loader, FileSearch, ArrowRight } from 'lucide-svelte';
	import { format, formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import type { DocumentSummary } from '$lib/api/types';

	// ─── Status config ─────────────────────────────────────────────────────────

	const STATUS_STEPS = [
		{ key: 'RECEIVED', label: 'Đã nhận hồ sơ', icon: CheckCircle },
		{ key: 'PROCESSING', label: 'Đang xử lý AI', icon: Loader },
		{ key: 'HITL_REVIEW', label: 'Kiểm tra thủ công', icon: AlertTriangle },
		{ key: 'VALIDATED', label: 'Hợp lệ — Chờ phê duyệt', icon: Clock },
		{ key: 'APPROVED', label: 'Đã phê duyệt', icon: CheckCircle },
		{ key: 'PUBLISHED', label: 'Đã phát hành', icon: CheckCircle }
	];

	const STATUS_DESCRIPTIONS: Record<string, string> = {
		RECEIVED: 'Hệ thống đã nhận được hồ sơ của bạn và đang chuẩn bị xử lý.',
		PROCESSING: 'Hệ thống AI đang phân tích và trích xuất thông tin từ hồ sơ.',
		HITL_REVIEW: 'Chuyên viên đang kiểm tra và xác minh nội dung hồ sơ.',
		VALIDATED: 'Hồ sơ đã được xác nhận hợp lệ và đang chờ lãnh đạo phê duyệt.',
		APPROVED: 'Lãnh đạo đã phê duyệt. Hồ sơ đang được xử lý cuối cùng.',
		PUBLISHED: 'Hồ sơ đã được phát hành. Kết quả đã được gửi đến bạn.',
		REJECTED: 'Hồ sơ không đáp ứng yêu cầu. Vui lòng kiểm tra email để biết lý do.'
	};

	const PRIORITY_LABELS: Record<string, string> = { NORMAL: 'Thường', URGENT: 'Khẩn', FLASH: 'Hỏa tốc' };
	const PRIORITY_COLORS: Record<string, string> = {
		NORMAL: 'bg-muted/60 text-muted-foreground border-border/30',
		URGENT: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
		FLASH: 'bg-red-500/10 text-red-500 border-red-500/30'
	};

	function getStepIndex(status: string): number {
		if (status === 'REJECTED') return -1;
		return STATUS_STEPS.findIndex((s) => s.key === status);
	}

	// ─── State ─────────────────────────────────────────────────────────────────

	let trackingInput = $state('');
	let submittedCode = $state('');
	let data = $state<DocumentSummary | null>(null);
	let isLoading = $state(false);
	let isError = $state(false);
	let errorMessage = $state('');

	let pollingTimer: ReturnType<typeof setInterval> | null = null;

	// ─── Fetch logic ───────────────────────────────────────────────────────────

	async function fetchStatus(code: string) {
		isLoading = true;
		isError = false;
		try {
			const res = await fetch(`/api/documents/${code}`);
			if (!res.ok) throw new Error(res.status === 404 ? 'Không tìm thấy hồ sơ.' : `Lỗi ${res.status}`);
			data = await res.json();
			if (pollingTimer) clearInterval(pollingTimer);
			if (data?.status === 'RECEIVED' || data?.status === 'PROCESSING') {
				pollingTimer = setInterval(() => fetchStatus(code), 5000);
			}
		} catch (e) {
			isError = true;
			errorMessage = e instanceof Error ? e.message : 'Mã theo dõi không đúng hoặc hồ sơ chưa được đăng ký.';
			data = null;
		} finally {
			isLoading = false;
		}
	}

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		if (!trackingInput.trim()) return;
		submittedCode = trackingInput.trim().toUpperCase();
		fetchStatus(submittedCode);
	}

	$effect(() => () => {
		if (pollingTimer) clearInterval(pollingTimer);
	});

	const currentStepIndex = $derived(data ? getStepIndex(data.status) : -1);
	const isRejected = $derived(data?.status === 'REJECTED');
</script>

<svelte:head>
	<title>Tra cứu hồ sơ — Cổng Dịch vụ Công</title>
	<meta name="description" content="Nhập mã theo dõi để kiểm tra trạng thái hồ sơ của bạn." />
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-12 animate-in fade-in duration-700">
	<!-- Page header -->
	<div class="mb-10 text-center">
		<div class="inline-flex items-center gap-2 mb-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 backdrop-blur-sm">
			<FileSearch size={16} class="text-primary" />
			<span class="text-xs font-bold tracking-widest text-primary uppercase">Kiểm tra trạng thái</span>
		</div>
		<h1 class="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
			Tra cứu hồ sơ
		</h1>
		<p class="mt-3 text-sm font-medium text-muted-foreground">
			Nhập mã theo dõi để kiểm tra trạng thái hồ sơ trực tuyến
		</p>
	</div>

	<!-- Search form -->
	<form onsubmit={handleSearch} class="mb-8">
		<div class="flex gap-3 glass-card rounded-2xl border border-border/40 p-2">
			<div class="relative flex-1">
				<Search size={16} class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
				<input
					id="tracking-input"
					type="text"
					bind:value={trackingInput}
					placeholder="VD: DVC-1736000000000-ABCD1234"
					class="w-full rounded-xl bg-transparent py-3 pl-10 pr-4 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all
						focus:bg-muted/20"
				/>
			</div>
			<button
				type="submit"
				disabled={!trackingInput.trim() || isLoading}
				class="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/20
					transition-all hover:bg-primary/90 disabled:opacity-40 active:scale-[0.97]"
			>
				{#if isLoading}
					<Loader size={16} class="animate-spin" />
					Đang tìm...
				{:else}
					<Search size={16} />
					Tra cứu
					<ArrowRight size={14} class="opacity-60" />
				{/if}
			</button>
		</div>
	</form>

	<!-- Loading skeleton -->
	{#if isLoading && !data}
		<div class="glass-card rounded-2xl border border-border/40 p-8 text-center space-y-4">
			<div class="flex justify-center">
				<div class="relative">
					<div class="h-14 w-14 rounded-full border-2 border-primary/20 animate-pulse"></div>
					<Loader size={24} class="absolute inset-0 m-auto animate-spin text-primary" />
				</div>
			</div>
			<p class="text-sm font-bold text-muted-foreground uppercase tracking-widest">Đang truy vấn hệ thống...</p>
		</div>
	{/if}

	<!-- Error state -->
	{#if isError}
		<div class="glass-card rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center animate-in slide-in-from-top-4 duration-300">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full border border-destructive/30 bg-destructive/10 p-4">
					<XCircle size={28} class="text-destructive" />
				</div>
			</div>
			<p class="font-extrabold text-foreground">Không tìm thấy hồ sơ</p>
			<p class="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
		</div>
	{/if}

	<!-- Result card -->
	{#if data && !isLoading}
		<div class="glass-card rounded-2xl border overflow-hidden animate-in slide-in-from-bottom-4 duration-500
			{isRejected ? 'border-destructive/20' : 'border-primary/20'}">

			<!-- Header band -->
			<div class="relative overflow-hidden px-7 py-6 {isRejected ? 'bg-destructive/10' : 'bg-primary/10'}">
				<div class="absolute inset-x-0 top-0 h-0.5 {isRejected ? 'bg-linear-to-r from-destructive to-red-400' : 'bg-linear-to-r from-primary to-purple-500'}"></div>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Mã theo dõi</p>
						<p class="font-mono text-xl font-extrabold text-foreground tracking-wider">{data.trackingCode}</p>
						<p class="mt-1.5 text-xs font-medium text-muted-foreground">
							Nộp lúc: {format(new Date(data.createdAt), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi })}
						</p>
					</div>
					<span class="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest {PRIORITY_COLORS[data.priority] ?? PRIORITY_COLORS.NORMAL}">
						{PRIORITY_LABELS[data.priority] ?? data.priority}
					</span>
				</div>
			</div>

			<div class="p-7 space-y-7">
				<!-- Status description banner -->
				<div class="rounded-xl border p-4 {isRejected ? 'border-destructive/20 bg-destructive/5' : 'border-primary/20 bg-primary/5'}">
					<p class="font-extrabold text-sm {isRejected ? 'text-destructive' : 'text-primary'}">
						{isRejected ? '✗ Hồ sơ bị từ chối' : (STATUS_STEPS[currentStepIndex]?.label ?? data.status)}
					</p>
					<p class="mt-1.5 text-xs font-medium text-muted-foreground leading-relaxed">
						{STATUS_DESCRIPTIONS[data.status] ?? 'Đang cập nhật...'}
					</p>
				</div>

				<!-- Progress timeline -->
				{#if !isRejected}
					<div class="space-y-4">
						<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tiến trình xử lý</p>
						{#each STATUS_STEPS.filter((s) => s.key !== 'HITL_REVIEW' || data?.status === 'HITL_REVIEW') as step, index}
							{@const stepDone = index < currentStepIndex}
							{@const stepActive = index === currentStepIndex}
							{@const stepPending = index > currentStepIndex}
							<div class="flex items-center gap-4">
								<!-- Dot/Icon -->
								<div class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all
									{stepDone ? 'border-emerald-500/50 bg-emerald-500/15' : stepActive ? 'border-primary/50 bg-primary/15 animate-pulse' : 'border-border/30 bg-muted/20'}">
									{#if stepDone}
										<CheckCircle size={15} class="text-emerald-500" />
									{:else if stepActive}
										<step.icon size={15} class="text-primary" />
									{:else}
										<step.icon size={15} class="text-muted-foreground/30" />
									{/if}
									<!-- Glow dot for active -->
									{#if stepActive}
										<span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background shadow-[0_0_6px_var(--color-primary)]"></span>
									{/if}
								</div>
								<!-- Label -->
								<div class="flex-1">
									<span class="text-sm font-bold
										{stepDone ? 'text-emerald-500' : stepActive ? 'text-primary' : 'text-muted-foreground/40'}">
										{step.label}
									</span>
								</div>
								<!-- Active badge -->
								{#if stepActive}
									<span class="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
										Đang xử lý
									</span>
								{/if}
							</div>
							<!-- Connector line between steps -->
							{#if index < STATUS_STEPS.filter((s) => s.key !== 'HITL_REVIEW' || data?.status === 'HITL_REVIEW').length - 1}
								<div class="ml-[17px] h-4 w-0.5 rounded-full {stepDone ? 'bg-emerald-500/30' : 'bg-border/30'}"></div>
							{/if}
						{/each}
					</div>
				{:else}
					<div class="flex items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
						<div class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 border border-destructive/30">
							<XCircle size={18} class="text-destructive" />
						</div>
						<div>
							<p class="font-bold text-destructive">Hồ sơ bị từ chối</p>
							<p class="text-xs text-muted-foreground mt-0.5">Kiểm tra email để biết lý do chi tiết</p>
						</div>
					</div>
				{/if}

				<!-- Meta grid -->
				<div class="grid grid-cols-2 gap-4 border-t border-border/40 pt-6">
					<div class="rounded-xl bg-muted/20 border border-border/30 p-4 space-y-1">
						<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cập nhật lần cuối</p>
						<p class="text-sm font-bold text-foreground">
							{formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true, locale: vi })}
						</p>
					</div>
					{#if data.slaDeadline}
						<div class="rounded-xl border p-4 space-y-1
							{new Date(data.slaDeadline) < new Date() ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/20 border-border/30'}">
							<p class="text-[10px] font-bold uppercase tracking-widest {new Date(data.slaDeadline) < new Date() ? 'text-destructive' : 'text-muted-foreground'}">Hạn xử lý</p>
							<p class="text-sm font-bold {new Date(data.slaDeadline) < new Date() ? 'text-destructive' : 'text-foreground'}">
								{format(new Date(data.slaDeadline), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi })}
							</p>
						</div>
					{:else}
						<div class="rounded-xl bg-muted/20 border border-border/30 p-4 space-y-1">
							<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ưu tiên</p>
							<p class="text-sm font-bold text-foreground">{PRIORITY_LABELS[data.priority] ?? data.priority}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Empty state hint -->
	{#if !data && !isLoading && !isError}
		<div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/10 py-16 text-center backdrop-blur-sm">
			<div class="mb-5 rounded-full border border-border/40 bg-muted/20 p-5">
				<FileSearch size={32} class="text-muted-foreground/30" />
			</div>
			<p class="font-bold text-foreground">Nhập mã theo dõi ở trên</p>
			<p class="mt-2 max-w-xs text-xs text-muted-foreground/60 leading-relaxed">
				Mã theo dõi sẽ được cấp cho bạn sau khi nộp hồ sơ thành công thông qua hệ thống AI của DVC.
			</p>
		</div>
	{/if}
</div>
