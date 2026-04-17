<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Inbox, Brain, CheckCircle2, Building2, ChevronRight,
		Loader2, MailCheck, AlertCircle, RefreshCw, Info, FileText, AlertTriangle
	} from 'lucide-svelte';
	import { format } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		DEPARTMENT_LABELS, VALID_DEPARTMENTS,
		DOCUMENT_TYPE_LABELS,
		type Department, type DocumentSummary
	} from '$lib/api/types';

	// ─── State ───────────────────────────────────────────────────────────────
	let documents = $state<DocumentSummary[]>([]);
	let isLoading = $state(true);
	let selectedDoc = $state<DocumentSummary | null>(null);
	let selectedReceptionFileIndex = $state(0);

	// Reset file index when switching documents
	$effect(() => {
		selectedDoc;
		selectedReceptionFileIndex = 0;
	});

	// Assignment form state per document
	let assignmentState = $state<Record<string, {
		dept: Department | '';
		note: string;
		isValid: boolean | null;
		suggestLoading: boolean;
		suggestReason: string;
		assigning: boolean;
		assigned: boolean;
		rejecting: boolean;
		invalidated: boolean;
		error: string;
	}>>({});

	// ─── Data fetch ───────────────────────────────────────────────────────────
	async function loadDocuments() {
		isLoading = true;
		try {
			const res = await fetch('/api/documents?status=RECEIVED&limit=100');
			if (!res.ok) throw new Error('Failed');
			const data = await res.json() as { documents: DocumentSummary[] };
			documents = data.documents ?? [];
			// Init assignment state for new docs
			for (const doc of documents) {
				if (!assignmentState[doc.id]) {
					assignmentState[doc.id] = {
						dept: '', note: '', isValid: null, suggestLoading: false,
						suggestReason: '', assigning: false, assigned: false,
						rejecting: false, invalidated: false, error: ''
					};
				}
			}
		} catch {
			documents = [];
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadDocuments();
	});

	// ─── AI suggestion ────────────────────────────────────────────────────────
	async function aiSuggest(doc: DocumentSummary) {
		const state = assignmentState[doc.id];
		if (!state) return;
		state.suggestLoading = true;
		state.suggestReason = '';
		state.error = '';
		assignmentState = { ...assignmentState };

		try {
			const res = await fetch(`/api/documents/${doc.trackingCode}/ai-suggest`, { method: 'POST' });
			const data = await res.json() as { is_valid?: boolean; department?: string; reason?: string };
			state.isValid = data.is_valid ?? true;
			if (data.department) {
				state.dept = data.department as Department;
			}
			state.suggestReason = data.reason ?? '';
		} catch {
			state.error = 'Không thể kết nối AI.';
		} finally {
			state.suggestLoading = false;
			assignmentState = { ...assignmentState };
		}
	}

	// ─── Assign action ────────────────────────────────────────────────────────
	async function assignDocument(doc: DocumentSummary) {
		const state = assignmentState[doc.id];
		if (!state || !state.dept) return;
		state.assigning = true;
		state.error = '';
		assignmentState = { ...assignmentState };

		try {
			const res = await fetch(`/api/documents/${doc.trackingCode}/assign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ department: state.dept, note: state.note })
			});
			const data = await res.json() as { success?: boolean; message?: string };
			if (!res.ok) {
				state.error = (data as { message?: string }).message ?? `Lỗi ${res.status}`;
			} else {
				state.assigned = true;
				// Remove from pending list after short delay
				setTimeout(() => {
					documents = documents.filter(d => d.id !== doc.id);
					if (selectedDoc?.id === doc.id) selectedDoc = null;
				}, 1500);
			}
		} catch {
			state.error = 'Đã xảy ra lỗi khi phân công.';
		} finally {
			state.assigning = false;
			assignmentState = { ...assignmentState };
		}
	}

	// ─── Reject action ────────────────────────────────────────────────────────
	async function rejectDocument(doc: DocumentSummary) {
		const state = assignmentState[doc.id];
		if (!state) return;
		state.rejecting = true;
		state.error = '';
		assignmentState = { ...assignmentState };

		try {
			const res = await fetch(`/api/documents/${doc.trackingCode}/reject`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason: state.note || state.suggestReason || 'Hồ sơ không hợp lệ' })
			});
			const data = await res.json() as { success?: boolean; message?: string };
			if (!res.ok) {
				state.error = (data as { message?: string }).message ?? `Lỗi ${res.status}`;
			} else {
				state.invalidated = true;
				setTimeout(() => {
					documents = documents.filter(d => d.id !== doc.id);
					if (selectedDoc?.id === doc.id) selectedDoc = null;
				}, 1500);
			}
		} catch {
			state.error = 'Đã xảy ra lỗi khi từ chối hồ sơ.';
		} finally {
			state.rejecting = false;
			assignmentState = { ...assignmentState };
		}
	}
	// ─── SLA helpers ──────────────────────────────────────────────────────────
	function isSlaBreached(doc: DocumentSummary): boolean {
		if (!doc.slaDeadline) return false;
		if (['APPROVED', 'REJECTED', 'INVALID'].includes(doc.status)) return false;
		return new Date(doc.slaDeadline) < new Date();
	}

	const sortedDocuments = $derived([...documents].sort((a, b) => {
		const aBreached = isSlaBreached(a) ? 0 : 1;
		const bBreached = isSlaBreached(b) ? 0 : 1;
		if (aBreached !== bBreached) return aBreached - bBreached;
		return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	}));

</script>

<svelte:head>
	<title>Tiếp nhận Hồ sơ — DVC Portal</title>
</svelte:head>

<div class="space-y-6 p-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
	<!-- Header -->
	<div class="flex items-center justify-between mb-2">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
				<div class="p-2 rounded-xl bg-primary/10 border border-primary/20">
					<Inbox size={28} class="text-primary" />
				</div>
				Bộ phận Một cửa — Tiếp nhận Hồ sơ
			</h1>
			<p class="mt-2 text-sm text-muted-foreground font-medium">
				Xem xét, gợi ý AI và phân công hồ sơ đến đơn vị thụ lý phù hợp
			</p>
		</div>
		<button
			onclick={loadDocuments}
			class="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 text-sm font-semibold transition-all"
		>
			<RefreshCw size={15} class={isLoading ? 'animate-spin' : ''} />
			Làm mới
		</button>
	</div>

	<!-- Stats bar -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
		{#each VALID_DEPARTMENTS as dept}
			<div class="glass-card rounded-2xl border border-border/40 p-4 space-y-1">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{DEPARTMENT_LABELS[dept as Department]}</p>
				<p class="text-2xl font-black text-foreground">—</p>
			</div>
		{/each}
	</div>

	<!-- Split panel -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		<!-- Left: document queue -->
		<div class="lg:col-span-5 xl:col-span-4 space-y-3 h-[calc(100vh-260px)] overflow-y-auto pr-1">
			{#if isLoading}
				{#each Array(5) as _}
					<div class="h-24 rounded-2xl bg-muted/20 animate-pulse border border-border/20"></div>
				{/each}
			{:else if documents.length === 0}
				<div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/10 py-20 text-center">
					<CheckCircle2 size={40} class="text-emerald-500/50 mb-4" />
					<p class="font-bold text-foreground">Không có hồ sơ mới</p>
					<p class="text-xs text-muted-foreground mt-1">Tất cả hồ sơ đã được phân công</p>
				</div>
			{:else}
				{#each sortedDocuments as doc}
					{@const state = assignmentState[doc.id]}
					{@const slaBreached = isSlaBreached(doc)}
					<button
						onclick={() => (selectedDoc = doc)}
						class="w-full text-left group"
					>
						<div class="glass-card rounded-2xl border transition-all duration-200 p-4
							{selectedDoc?.id === doc.id
								? 'border-primary/40 bg-primary/5 ring-2 ring-primary/20'
								: slaBreached
									? 'border-destructive/40 bg-destructive/5'
									: 'border-border/30 hover:border-primary/20 hover:bg-muted/20'}
							{state?.assigned ? 'opacity-40' : ''}">
							{#if slaBreached}
								<div class="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/20">
									<AlertTriangle size={11} class="text-destructive shrink-0" />
									<span class="text-[10px] font-bold uppercase tracking-wider text-destructive">⚠ QUÁ HẠN SLA</span>
								</div>
							{/if}
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<p class="font-mono text-[11px] font-bold text-primary tracking-widest uppercase truncate">
										{doc.trackingCode}
									</p>
									<p class="mt-1 text-sm font-semibold text-foreground">
										{DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}
									</p>
									<p class="mt-0.5 text-xs text-muted-foreground">
										{format(new Date(doc.createdAt), "HH:mm, dd/MM/yyyy", { locale: vi })}
									</p>
									{#if doc.slaDeadline}
										<p class="mt-1 text-[10px] font-bold {slaBreached ? 'text-destructive' : 'text-muted-foreground'}">
											⏰ {format(new Date(doc.slaDeadline), "HH:mm dd/MM", { locale: vi })}
										</p>
									{/if}
								</div>
								<div class="flex flex-col items-end gap-1.5 shrink-0">
									<PriorityBadge documentType={doc.documentType} />
									{#if state?.assigned}
										<span class="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
											<CheckCircle2 size={10} /> Đã phân công
										</span>
									{/if}
								</div>
							</div>
							{#if state?.dept}
								<div class="mt-2 pt-2 border-t border-border/20 text-[11px] font-semibold text-primary/70">
									→ {DEPARTMENT_LABELS[state.dept as Department]}
								</div>
							{/if}
						</div>
					</button>
				{/each}
			{/if}
		</div>

		<!-- Right: assignment panel -->
		<div class="lg:col-span-7 xl:col-span-8">
			{#if selectedDoc}
				{@const doc = selectedDoc}
				{@const state = assignmentState[doc.id]}
				{@const slaBreached = isSlaBreached(doc)}
				<div class="glass-card rounded-3xl overflow-hidden shadow-2xl sticky top-6 animate-in slide-in-from-right-8 duration-400 border {slaBreached ? 'border-destructive/40' : 'border-border/30'}">
					<!-- Top accent -->
					<div class="h-1 w-full {slaBreached ? 'bg-destructive' : 'bg-linear-to-r from-primary via-violet-500 to-primary'}"></div>

					{#if slaBreached}
						<div class="flex items-center gap-2 px-6 py-3 bg-destructive/10 border-b border-destructive/20">
							<AlertTriangle size={15} class="text-destructive shrink-0" />
							<p class="text-xs font-bold text-destructive">
								⚠ Hồ sơ QUÁ HẠN SLA — Cần xử lý ngay!
							</p>
						</div>
					{/if}

					<!-- Doc info header -->
					<div class="p-6 pb-4 border-b border-border/30 bg-muted/10">
						<div class="flex items-start justify-between gap-4">
							<div class="space-y-1 min-w-0">
								<p class="font-mono text-xs font-bold text-primary tracking-[0.2em] uppercase">{doc.trackingCode}</p>
								<h2 class="text-xl font-extrabold text-foreground">
									{DOCUMENT_TYPE_LABELS[doc.documentType]} — Chờ phân công
								</h2>
								<p class="text-sm text-muted-foreground">
									Nộp lúc {format(new Date(doc.createdAt), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi })}
								</p>
							</div>
							<StatusBadge status={doc.status} />
						</div>
					</div>

					<!-- Inline File Viewer -->
					{#if doc.rawFileUrls && doc.rawFileUrls.length > 0}
						<div class="border-b border-border/30">
							<!-- Tab bar (only shown when multiple files) -->
							{#if doc.rawFileUrls.length > 1}
								<div class="flex items-center gap-1 px-4 pt-3 pb-0 bg-muted/10 border-b border-border/20 overflow-x-auto">
									{#each doc.rawFileUrls as _url, idx}
										<button
											type="button"
											onclick={() => (selectedReceptionFileIndex = idx)}
											class="shrink-0 px-3 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2
												{selectedReceptionFileIndex === idx
													? 'border-primary text-primary bg-background'
													: 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'}"
										>
											<FileText size={11} class="inline mr-1" />Tệp {idx + 1}
										</button>
									{/each}
								</div>
							{:else}
								<div class="flex items-center gap-2 px-4 py-2.5 bg-muted/10 border-b border-border/20">
									<FileText size={13} class="text-primary" />
									<span class="text-xs font-bold text-muted-foreground">{doc.rawFileUrls[0].split('/').pop()}</span>
									<a href={doc.rawFileUrls[0]} target="_blank" class="ml-auto text-[10px] font-bold text-primary/70 hover:text-primary">↗ Mở tab mới</a>
								</div>
							{/if}
							<!-- iframe viewer -->
							{#if (doc.rawFileUrls[selectedReceptionFileIndex] ?? doc.rawFileUrls[0]).match(/\.(pdf)$/i)}
								<iframe
									src={doc.rawFileUrls[selectedReceptionFileIndex] ?? doc.rawFileUrls[0]}
									title="Tệp hồ sơ"
									class="w-full h-[480px] border-0"
								></iframe>
							{:else}
								<div class="w-full h-[480px] flex items-center justify-center bg-muted/10 p-4">
									<img
										src={doc.rawFileUrls[selectedReceptionFileIndex] ?? doc.rawFileUrls[0]}
										alt="Tệp hồ sơ"
										class="max-h-full max-w-full object-contain rounded-xl"
									/>
								</div>
							{/if}
							{#if doc.rawFileUrls.length > 1}
								<div class="flex items-center justify-end gap-2 px-4 py-2 bg-muted/5 border-t border-border/20">
									<a href={doc.rawFileUrls[selectedReceptionFileIndex] ?? doc.rawFileUrls[0]} target="_blank" class="text-[10px] font-bold text-primary/70 hover:text-primary">↗ Mở Tệp {selectedReceptionFileIndex + 1} trong tab mới</a>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Assignment form -->
					<div class="p-6 space-y-6">
						<!-- AI suggestion -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<label class="text-xs font-black uppercase tracking-widest text-muted-foreground">
									Đơn vị thụ lý <span class="text-destructive">*</span>
								</label>
								<button
									onclick={() => aiSuggest(doc)}
									disabled={state?.suggestLoading}
									class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20
										text-violet-400 text-xs font-bold hover:bg-violet-500/20 transition-all disabled:opacity-50"
								>
									{#if state?.suggestLoading}
										<Loader2 size={13} class="animate-spin" /> Đang hỏi AI...
									{:else}
										<Brain size={13} /> AI Gợi ý
									{/if}
								</button>
							</div>

							{#if state?.suggestReason}
								<div class="space-y-3">
									{#if state.isValid}
										<div class="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[12px] text-emerald-400">
											<CheckCircle2 size={13} class="mt-0.5 shrink-0" />
											<div class="min-w-0">
												<strong>AI Đánh giá: Hợp lệ</strong>
												<p class="mt-0.5">{state.suggestReason}</p>
											</div>
										</div>
									{:else}
										<div class="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-[12px] text-destructive">
											<AlertCircle size={13} class="mt-0.5 shrink-0" />
											<div class="min-w-0">
												<strong>AI Đánh giá: KHÔNG hợp lệ / Thiếu sót</strong>
												<p class="mt-0.5">{state.suggestReason}</p>
											</div>
										</div>
									{/if}
								</div>
							{/if}

							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{#each VALID_DEPARTMENTS as dept}
									<label class="flex items-center gap-3 cursor-pointer p-3.5 rounded-2xl border-2 transition-all duration-200
										{state?.dept === dept
											? 'border-primary bg-primary/5'
											: 'border-border/30 hover:border-primary/30 hover:bg-muted/10'}">
										<input
											type="radio"
											name="dept-{doc.id}"
											value={dept}
											checked={state?.dept === dept}
											onchange={() => { if (state) { state.dept = dept as Department; assignmentState = { ...assignmentState }; } }}
											class="sr-only"
										/>
										<div class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
											{state?.dept === dept ? 'border-primary bg-primary' : 'border-muted-foreground/30'}">
											{#if state?.dept === dept}
												<div class="w-1.5 h-1.5 rounded-full bg-primary-foreground"></div>
											{/if}
										</div>
										<div class="min-w-0">
											<p class="text-sm font-semibold leading-tight {state?.dept === dept ? 'text-primary' : 'text-foreground'}">{DEPARTMENT_LABELS[dept as Department]}</p>
										</div>
									</label>
								{/each}
							</div>
						</div>

						<!-- Note/Reason -->
						<div class="space-y-2">
							<label for="assign-note-{doc.id}" class="text-xs font-black uppercase tracking-widest text-muted-foreground">
								Lý do từ chối / Ghi chú phân công
							</label>
							<textarea
								id="assign-note-{doc.id}"
								rows={3}
								placeholder="Ghi chú về lý do từ chối hoặc hướng xử lý cho đơn vị..."
								value={state?.note ?? ''}
								oninput={(e) => { if (state) { state.note = (e.target as HTMLTextAreaElement).value; assignmentState = { ...assignmentState }; } }}
								class="w-full rounded-2xl bg-muted/20 border border-border/30 px-4 py-3 text-sm resize-none
									focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all"
							></textarea>
						</div>

						<!-- Error -->
						{#if state?.error}
							<div class="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold">
								<AlertCircle size={15} />
								{state.error}
							</div>
						{/if}

						<!-- Action buttons -->
						{#if state?.assigned}
							<div class="flex items-center gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
								<MailCheck size={18} />
								Đã phân công! Email thông báo đã gửi đến công dân.
							</div>
						{:else if state?.invalidated}
							<div class="flex items-center gap-2 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive font-bold">
								<AlertCircle size={18} />
								Đã từ chối! Yêu cầu công dân bổ sung hồ sơ.
							</div>
						{:else}
							<div class="flex flex-col sm:flex-row gap-3">
								<button
									onclick={() => assignDocument(doc)}
									disabled={!state?.dept || state?.assigning || state?.rejecting}
									class="flex-1 h-14 rounded-2xl bg-primary text-primary-foreground font-extrabold text-base
										flex items-center justify-center gap-2 shadow-lg shadow-primary/20
										hover:bg-primary/90 active:scale-[0.98] transition-all
										disabled:opacity-40 disabled:cursor-not-allowed"
								>
									{#if state?.assigning}
										<Loader2 size={18} class="animate-spin" /> Xử lý...
									{:else}
										<Building2 size={18} />
										Phân công cho {state?.dept ? DEPARTMENT_LABELS[state.dept as Department] : '...'}
									{/if}
								</button>

								<button
									onclick={() => rejectDocument(doc)}
									disabled={state?.assigning || state?.rejecting}
									class="px-6 h-14 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 font-extrabold text-sm
										flex flex-col sm:flex-row items-center justify-center gap-2 hover:bg-destructive/20 active:scale-[0.98] transition-all
										disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
								>
									{#if state?.rejecting}
										<Loader2 size={16} class="animate-spin" /> Từ chối
									{:else}
										Từ chối
									{/if}
								</button>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center h-[400px] rounded-3xl border-2 border-dashed border-border/30 bg-muted/5 text-center">
					<div class="p-5 rounded-full bg-muted/20 border border-border/30 mb-5">
						<Inbox size={36} class="text-muted-foreground/30" />
					</div>
					<p class="font-bold text-foreground">Chọn hồ sơ từ danh sách bên trái</p>
					<p class="text-sm text-muted-foreground mt-1 max-w-xs">
						Xem chi tiết, nhận gợi ý AI và phân công đến đơn vị thụ lý
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
