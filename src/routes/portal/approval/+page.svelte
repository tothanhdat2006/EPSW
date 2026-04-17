<script lang="ts">
	import {
		CheckCircle, XCircle, Brain, FileText, ShieldAlert, User,
		Building2, Calendar, Clock, Fingerprint, ChevronRight, Loader2
	} from 'lucide-svelte';
	import { formatDistanceToNow, format } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { documentsApi } from '$lib/api/client';
	import type { DocumentSummary } from '$lib/api/types';
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface ExtractedData {
		[key: string]: unknown;
		summary?: string;
		documentType?: string;
		issuingAuthority?: string;
		subjectName?: string;
		subjectId?: string;
		address?: string;
		purpose?: string;
		referenceNumber?: string;
		issueDate?: string;
		expiryDate?: string;
		keywords?: string[];
		securityLevel?: string;
		rawText?: string;
	}

	interface DocumentWithData extends DocumentSummary {
		extractedData?: ExtractedData;
	}

	// ─── State ────────────────────────────────────────────────────────────────

	let documents = $state<DocumentWithData[]>([]);
	let isLoading = $state(true);
	let selectedDoc = $state<DocumentWithData | null>(null);
	let rejectionReason = $state('');
	let isActing = $state(false);
	let actionResult = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	// ─── Data fetching ────────────────────────────────────────────────────────

	async function loadDocuments() {
		isLoading = true;
		try {
			const result = await documentsApi.list({ status: 'VALIDATED', limit: 100 });
			documents = result.documents as DocumentWithData[];
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		loadDocuments();
		const timer = setInterval(loadDocuments, 15_000);
		return () => clearInterval(timer);
	});

	async function act(approved: boolean) {
		if (!selectedDoc) return;
		if (!approved && !rejectionReason.trim()) return;
		isActing = true;
		actionResult = null;
		try {
			await documentsApi.approve(selectedDoc.id, {
				approved,
				reason: rejectionReason || undefined
			});
			actionResult = {
				type: 'success',
				message: approved ? 'Hồ sơ đã được phê duyệt thành công.' : 'Hồ sơ đã bị từ chối.'
			};
			await loadDocuments();
			selectedDoc = null;
			rejectionReason = '';
			setTimeout(() => (actionResult = null), 3000);
		} catch {
			actionResult = { type: 'error', message: 'Có lỗi xảy ra. Vui lòng thử lại.' };
		} finally {
			isActing = false;
		}
	}

	function parseExtracted(doc: DocumentWithData): ExtractedData {
		if (!doc.extractedData) return {};
		if (typeof doc.extractedData === 'string') {
			try { return JSON.parse(doc.extractedData); } catch { return {}; }
		}
		return doc.extractedData as ExtractedData;
	}

	const extracted = $derived(selectedDoc ? parseExtracted(selectedDoc) : null);
</script>

<svelte:head>
	<title>Phê duyệt Lãnh đạo — DVC Portal</title>
</svelte:head>

<div class="flex h-full min-h-screen animate-in fade-in duration-500">
	<!-- ─── Left: Document Queue ─────────────────────────────────────────── -->
	<div class="flex w-80 shrink-0 flex-col border-r border-border/50 bg-muted/10">
		<!-- Header -->
		<div class="border-b border-border/50 px-5 py-5">
			<h1 class="text-lg font-extrabold tracking-tight text-foreground">Phê duyệt Lãnh đạo</h1>
			<p class="mt-0.5 text-xs font-medium text-muted-foreground">
				{#if isLoading}
					<span class="animate-pulse">Đang tải...</span>
				{:else}
					{documents.length} hồ sơ chờ phê duyệt
				{/if}
			</p>
		</div>

		<!-- List -->
		<div class="flex-1 overflow-y-auto p-3 space-y-2">
			{#if isLoading}
				{#each Array(4) as _}
					<div class="rounded-xl border border-border/30 bg-card p-4 space-y-2">
						<Skeleton class="h-4 w-32" />
						<Skeleton class="h-3 w-48" />
						<Skeleton class="h-3 w-24" />
					</div>
				{/each}
			{:else if documents.length === 0}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
						<CheckCircle size={32} class="text-emerald-500" />
					</div>
					<p class="text-sm font-semibold text-foreground">Tất cả đã xử lý!</p>
					<p class="mt-1 text-xs text-muted-foreground">Không có hồ sơ nào chờ phê duyệt</p>
				</div>
			{:else}
				{#each documents as doc}
					{@const ext = parseExtracted(doc)}
					<button
						onclick={() => { selectedDoc = doc; rejectionReason = ''; actionResult = null; }}
						class="group w-full rounded-xl border text-left transition-all duration-200
							{selectedDoc?.id === doc.id
								? 'border-primary/40 bg-primary/5 shadow-sm shadow-primary/10'
								: 'border-border/30 bg-card hover:border-border hover:bg-card/80'}"
					>
						<div class="p-4">
							<div class="flex items-start justify-between gap-2 mb-2">
								<span class="font-mono text-[11px] font-bold text-primary">{doc.trackingCode}</span>
								<PriorityBadge documentType={doc.documentType} />
							</div>
							<p class="text-sm font-semibold text-foreground line-clamp-1">
								{ext.documentType ?? 'Loại chưa xác định'}
							</p>
							{#if ext.subjectName}
								<p class="mt-0.5 text-xs text-muted-foreground line-clamp-1">{ext.subjectName}</p>
							{/if}
							<div class="mt-2.5 flex items-center justify-between">
								{#if doc.slaDeadline}
									<span class="flex items-center gap-1 text-[10px] font-medium {new Date(doc.slaDeadline) < new Date() ? 'text-destructive' : 'text-muted-foreground'}">
										<Clock size={10} />
										{formatDistanceToNow(new Date(doc.slaDeadline), { addSuffix: true, locale: vi })}
									</span>
								{:else}
									<span></span>
								{/if}
								<ChevronRight size={12} class="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
							</div>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</div>

	<!-- ─── Right: Detail & Action Panel ────────────────────────────────── -->
	<div class="flex flex-1 flex-col overflow-hidden">
		{#if actionResult}
			<div class="mx-8 mt-4 rounded-xl border px-4 py-3 text-sm font-semibold animate-in slide-in-from-top-2 duration-300
				{actionResult.type === 'success'
					? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
					: 'border-destructive/30 bg-destructive/10 text-destructive'}">
				{actionResult.message}
			</div>
		{/if}

		{#if !selectedDoc}
			<div class="flex flex-1 flex-col items-center justify-center text-center p-12">
				<div class="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted/30 border border-border/30">
					<FileText size={36} class="text-muted-foreground/40" />
				</div>
				<p class="text-base font-semibold text-muted-foreground">Chọn hồ sơ để xem chi tiết</p>
				<p class="mt-1 text-xs text-muted-foreground/60">Nhấn vào một hồ sơ ở danh sách bên trái</p>
			</div>
		{:else}
			<div class="flex-1 overflow-y-auto">
				<div class="max-w-3xl mx-auto p-8 space-y-6">

					<!-- Header -->
					<div class="flex items-start justify-between gap-4">
						<div>
							<div class="flex items-center gap-2 mb-1">
								<StatusBadge status={selectedDoc.status} />
								<PriorityBadge documentType={selectedDoc.documentType} />
							</div>
							<h2 class="text-2xl font-extrabold tracking-tight text-foreground">
								{extracted?.documentType ?? 'Hồ sơ chờ duyệt'}
							</h2>
							<p class="mt-1 font-mono text-xs font-bold text-primary">{selectedDoc.trackingCode}</p>
						</div>
						{#if typeof selectedDoc.aiConfidence === 'number'}
							<div class="shrink-0 flex flex-col items-center justify-center rounded-2xl border px-5 py-3
								{selectedDoc.aiConfidence >= 70
									? 'border-emerald-500/30 bg-emerald-500/10'
									: 'border-amber-500/30 bg-amber-500/10'}">
								<span class="text-2xl font-black font-mono {selectedDoc.aiConfidence >= 70 ? 'text-emerald-400' : 'text-amber-400'}">
									{selectedDoc.aiConfidence.toFixed(0)}%
								</span>
								<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">AI Score</span>
							</div>
						{/if}
					</div>

					<!-- AI Summary -->
					{#if extracted?.summary}
						<div class="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
							<p class="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400">
								<Brain size={13} /> Tóm tắt AI
							</p>
							<p class="text-sm leading-relaxed text-foreground/80">{extracted.summary}</p>
						</div>
					{/if}

					<!-- Key info grid -->
					<div class="grid grid-cols-2 gap-3">
						{#each [
							{ icon: Building2, label: 'Cơ quan ban hành', value: extracted?.issuingAuthority },
							{ icon: User, label: 'Đối tượng', value: extracted?.subjectName },
							{ icon: Fingerprint, label: 'Số định danh', value: extracted?.subjectId },
							{ icon: FileText, label: 'Số tham chiếu', value: extracted?.referenceNumber },
							{ icon: Calendar, label: 'Ngày ban hành', value: extracted?.issueDate },
							{ icon: Clock, label: 'Ngày hết hạn', value: extracted?.expiryDate },
							{ icon: ShieldAlert, label: 'Mức bảo mật', value: selectedDoc.securityLevel },
							{ icon: FileText, label: 'Mục đích', value: extracted?.purpose }
						] as item}
							{#if item.value}
								<div class="rounded-xl border border-border/30 bg-card p-4">
									<p class="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
										<item.icon size={11} />{item.label}
									</p>
									<p class="text-sm font-semibold text-foreground line-clamp-2">{item.value}</p>
								</div>
							{/if}
						{/each}
					</div>

					<!-- Keywords -->
					{#if extracted?.keywords?.length}
						<div class="rounded-xl border border-border/30 bg-card p-4">
							<p class="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Từ khóa</p>
							<div class="flex flex-wrap gap-1.5">
								{#each extracted.keywords as kw}
									<span class="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{kw}</span>
								{/each}
							</div>
						</div>
					{/if}

					<!-- HR -->
					<div class="border-t border-border/40"></div>

					<!-- Rejection reason -->
					<div>
						<label for="rejection" class="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
							Lý do từ chối (bắt buộc nếu không duyệt)
						</label>
						<textarea
							id="rejection"
							bind:value={rejectionReason}
							placeholder="Nhập lý do từ chối hồ sơ..."
							rows={3}
							class="w-full resize-none rounded-xl border border-border/50 bg-background/80 px-4 py-3 text-sm
								text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
								focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
						></textarea>
					</div>

					<!-- Action buttons -->
					<div class="flex gap-3 pb-4">
						<button
							onclick={() => act(true)}
							disabled={isActing}
							class="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-extrabold
								bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20
								transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#if isActing}
								<Loader2 size={16} class="animate-spin" />
							{:else}
								<CheckCircle size={16} />
							{/if}
							Phê duyệt
						</button>
						<button
							onclick={() => act(false)}
							disabled={isActing || !rejectionReason.trim()}
							class="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-extrabold
								bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30
								transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{#if isActing}
								<Loader2 size={16} class="animate-spin" />
							{:else}
								<XCircle size={16} />
							{/if}
							Từ chối
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
