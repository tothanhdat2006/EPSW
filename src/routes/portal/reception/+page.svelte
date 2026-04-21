<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Inbox,
		Brain,
		CheckCircle2,
		Building2,
		ChevronRight,
		Loader2,
		MailCheck,
		AlertCircle,
		RefreshCw,
		Info,
		FileText,
		AlertTriangle
	} from 'lucide-svelte';
	import { format } from 'date-fns';
	import { getDateLocale, locale } from '$lib/i18n';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		VALID_DEPARTMENTS,
		getDepartmentLabel,
		getDocumentTypeLabel,
		type Department,
		type DocumentSummary
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
	let assignmentState = $state<
		Record<
			string,
			{
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
			}
		>
	>({});

	const ui = $derived(
		$locale === 'en'
			? {
					title: 'One-stop desk — Record intake',
					subtitle:
						'Review records, request AI guidance, and assign them to the appropriate department.',
					refresh: 'Refresh',
					noNewRecords: 'No new records',
					allAssigned: 'All records have been assigned',
					slaShort: 'OVERDUE SLA',
					slaBanner: 'Record is overdue for SLA processing and needs immediate action.',
					waitingAssignment: 'Waiting for assignment',
					submittedAt: 'Submitted at',
					file: 'File',
					openNewTab: 'Open in new tab',
					handlingDepartment: 'Handling department',
					askingAi: 'Asking AI...',
					aiSuggest: 'AI Suggest',
					aiValid: 'AI assessment: Valid',
					aiInvalid: 'AI assessment: INVALID / Incomplete',
					noteLabel: 'Rejection reason / Assignment note',
					notePlaceholder:
						'Notes about the rejection reason or handling direction for the department...',
					assignedSuccess:
						'Assigned successfully. Notification email has been sent to the citizen.',
					rejectedSuccess:
						'Rejected successfully. The citizen has been asked to supplement the record.',
					processing: 'Processing...',
					assignTo: 'Assign to',
					reject: 'Reject',
					selectRecord: 'Select a record from the list on the left',
					selectHint:
						'View details, request AI guidance, and assign it to the responsible department',
					invalidFallback: 'Invalid record',
					aiConnectError: 'Unable to connect to AI.',
					assignError: 'An error occurred while assigning the record.',
					rejectError: 'An error occurred while rejecting the record.',
					assignedLabel: 'Assigned'
				}
			: {
					title: 'Bộ phận Một cửa — Tiếp nhận Hồ sơ',
					subtitle: 'Xem xét, gợi ý AI và phân công hồ sơ đến đơn vị thụ lý phù hợp',
					refresh: 'Làm mới',
					noNewRecords: 'Không có hồ sơ mới',
					allAssigned: 'Tất cả hồ sơ đã được phân công',
					slaShort: 'QUÁ HẠN SLA',
					slaBanner: 'Hồ sơ QUÁ HẠN SLA — Cần xử lý ngay!',
					waitingAssignment: 'Chờ phân công',
					submittedAt: 'Nộp lúc',
					file: 'Tệp',
					openNewTab: 'Mở tab mới',
					handlingDepartment: 'Đơn vị thụ lý',
					askingAi: 'Đang hỏi AI...',
					aiSuggest: 'AI Gợi ý',
					aiValid: 'AI Đánh giá: Hợp lệ',
					aiInvalid: 'AI Đánh giá: KHÔNG hợp lệ / Thiếu sót',
					noteLabel: 'Lý do từ chối / Ghi chú phân công',
					notePlaceholder: 'Ghi chú về lý do từ chối hoặc hướng xử lý cho đơn vị...',
					assignedSuccess: 'Đã phân công! Email thông báo đã gửi đến công dân.',
					rejectedSuccess: 'Đã từ chối! Yêu cầu công dân bổ sung hồ sơ.',
					processing: 'Xử lý...',
					assignTo: 'Phân công cho',
					reject: 'Từ chối',
					selectRecord: 'Chọn hồ sơ từ danh sách bên trái',
					selectHint: 'Xem chi tiết, nhận gợi ý AI và phân công đến đơn vị thụ lý',
					invalidFallback: 'Hồ sơ không hợp lệ',
					aiConnectError: 'Không thể kết nối AI.',
					assignError: 'Đã xảy ra lỗi khi phân công.',
					rejectError: 'Đã xảy ra lỗi khi từ chối hồ sơ.',
					assignedLabel: 'Đã phân công'
				}
	);

	// ─── Data fetch ───────────────────────────────────────────────────────────
	async function loadDocuments() {
		isLoading = true;
		try {
			const res = await fetch('/api/documents?status=RECEIVED&limit=100');
			if (!res.ok) throw new Error('Failed');
			const data = (await res.json()) as { documents: DocumentSummary[] };
			documents = data.documents ?? [];
			// Init assignment state for new docs
			for (const doc of documents) {
				if (!assignmentState[doc.id]) {
					assignmentState[doc.id] = {
						dept: '',
						note: '',
						isValid: null,
						suggestLoading: false,
						suggestReason: '',
						assigning: false,
						assigned: false,
						rejecting: false,
						invalidated: false,
						error: ''
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
			const data = (await res.json()) as {
				is_valid?: boolean;
				department?: string;
				reason?: string;
			};
			state.isValid = data.is_valid ?? true;
			if (data.department) {
				state.dept = data.department as Department;
			}
			state.suggestReason = data.reason ?? '';
		} catch {
			state.error = ui.aiConnectError;
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
			const data = (await res.json()) as { success?: boolean; message?: string };
			if (!res.ok) {
				state.error = (data as { message?: string }).message ?? `Lỗi ${res.status}`;
			} else {
				state.assigned = true;
				// Remove from pending list after short delay
				setTimeout(() => {
					documents = documents.filter((d) => d.id !== doc.id);
					if (selectedDoc?.id === doc.id) selectedDoc = null;
				}, 1500);
			}
		} catch {
			state.error = ui.assignError;
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
				body: JSON.stringify({ reason: state.note || state.suggestReason || ui.invalidFallback })
			});
			const data = (await res.json()) as { success?: boolean; message?: string };
			if (!res.ok) {
				state.error = (data as { message?: string }).message ?? `Lỗi ${res.status}`;
			} else {
				state.invalidated = true;
				setTimeout(() => {
					documents = documents.filter((d) => d.id !== doc.id);
					if (selectedDoc?.id === doc.id) selectedDoc = null;
				}, 1500);
			}
		} catch {
			state.error = ui.rejectError;
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

	const sortedDocuments = $derived(
		[...documents].sort((a, b) => {
			const aBreached = isSlaBreached(a) ? 0 : 1;
			const bBreached = isSlaBreached(b) ? 0 : 1;
			if (aBreached !== bBreached) return aBreached - bBreached;
			return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
		})
	);
</script>

<svelte:head>
	<title>{ui.title} — DVC Portal</title>
</svelte:head>

<div class="mx-auto max-w-[1600px] animate-in space-y-6 p-8 duration-700 fade-in">
	<!-- Header -->
	<div class="mb-2 flex items-center justify-between">
		<div>
			<h1 class="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-foreground">
				<div class="rounded-xl border border-primary/20 bg-primary/10 p-2">
					<Inbox size={28} class="text-primary" />
				</div>
				{ui.title}
			</h1>
			<p class="mt-2 text-sm font-medium text-muted-foreground">
				{ui.subtitle}
			</p>
		</div>
		<button
			onclick={loadDocuments}
			class="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-4 py-2 text-sm font-semibold transition-all hover:bg-muted/40"
		>
			<RefreshCw size={15} class={isLoading ? 'animate-spin' : ''} />
			{ui.refresh}
		</button>
	</div>

	<!-- Stats bar -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		{#each VALID_DEPARTMENTS as dept}
			<div class="glass-card space-y-1 rounded-2xl border border-border/40 p-4">
				<p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
					{getDepartmentLabel(dept as Department, $locale)}
				</p>
				<p class="text-2xl font-black text-foreground">—</p>
			</div>
		{/each}
	</div>

	<!-- Split panel -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<!-- Left: document queue -->
		<div class="h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1 lg:col-span-5 xl:col-span-4">
			{#if isLoading}
				{#each Array(5) as _}
					<div class="h-24 animate-pulse rounded-2xl border border-border/20 bg-muted/20"></div>
				{/each}
			{:else if documents.length === 0}
				<div
					class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/10 py-20 text-center"
				>
					<CheckCircle2 size={40} class="mb-4 text-emerald-500/50" />
					<p class="font-bold text-foreground">{ui.noNewRecords}</p>
					<p class="mt-1 text-xs text-muted-foreground">{ui.allAssigned}</p>
				</div>
			{:else}
				{#each sortedDocuments as doc}
					{@const state = assignmentState[doc.id]}
					{@const slaBreached = isSlaBreached(doc)}
					<button onclick={() => (selectedDoc = doc)} class="group w-full text-left">
						<div
							class="glass-card rounded-2xl border p-4 transition-all duration-200
							{selectedDoc?.id === doc.id
								? 'border-primary/40 bg-primary/5 ring-2 ring-primary/20'
								: slaBreached
									? 'border-destructive/40 bg-destructive/5'
									: 'border-border/30 hover:border-primary/20 hover:bg-muted/20'}
							{state?.assigned ? 'opacity-40' : ''}"
						>
							{#if slaBreached}
								<div
									class="mb-2 flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 px-2 py-1"
								>
									<AlertTriangle size={11} class="shrink-0 text-destructive" />
									<span class="text-[10px] font-bold tracking-wider text-destructive uppercase"
										>⚠ {ui.slaShort}</span
									>
								</div>
							{/if}
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<p
										class="truncate font-mono text-[11px] font-bold tracking-widest text-primary uppercase"
									>
										{doc.trackingCode}
									</p>
									<p class="mt-1 text-sm font-semibold text-foreground">
										{getDocumentTypeLabel(doc.documentType, $locale)}
									</p>
									<p class="mt-0.5 text-xs text-muted-foreground">
										{format(new Date(doc.createdAt), 'HH:mm, dd/MM/yyyy', {
											locale: getDateLocale($locale)
										})}
									</p>
									{#if doc.slaDeadline}
										<p
											class="mt-1 text-[10px] font-bold {slaBreached
												? 'text-destructive'
												: 'text-muted-foreground'}"
										>
											⏰ {format(new Date(doc.slaDeadline), 'HH:mm dd/MM', {
												locale: getDateLocale($locale)
											})}
										</p>
									{/if}
								</div>
								<div class="flex shrink-0 flex-col items-end gap-1.5">
									<PriorityBadge documentType={doc.documentType} />
									{#if state?.assigned}
										<span class="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
											<CheckCircle2 size={10} />
											{ui.assignedLabel}
										</span>
									{/if}
								</div>
							</div>
							{#if state?.dept}
								<div
									class="mt-2 border-t border-border/20 pt-2 text-[11px] font-semibold text-primary/70"
								>
									→ {getDepartmentLabel(state.dept as Department, $locale)}
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
				<div
					class="glass-card sticky top-6 animate-in overflow-hidden rounded-3xl border shadow-2xl duration-400 slide-in-from-right-8 {slaBreached
						? 'border-destructive/40'
						: 'border-border/30'}"
				>
					<!-- Top accent -->
					<div
						class="h-1 w-full {slaBreached
							? 'bg-destructive'
							: 'bg-linear-to-r from-primary via-violet-500 to-primary'}"
					></div>

					{#if slaBreached}
						<div
							class="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-6 py-3"
						>
							<AlertTriangle size={15} class="shrink-0 text-destructive" />
							<p class="text-xs font-bold text-destructive">
								⚠ {ui.slaBanner}
							</p>
						</div>
					{/if}

					<!-- Doc info header -->
					<div class="border-b border-border/30 bg-muted/10 p-6 pb-4">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 space-y-1">
								<p class="font-mono text-xs font-bold tracking-[0.2em] text-primary uppercase">
									{doc.trackingCode}
								</p>
								<h2 class="text-xl font-extrabold text-foreground">
									{getDocumentTypeLabel(doc.documentType, $locale)} — {ui.waitingAssignment}
								</h2>
								<p class="text-sm text-muted-foreground">
									{ui.submittedAt}
									{format(new Date(doc.createdAt), "HH:mm 'ngày' dd/MM/yyyy", {
										locale: getDateLocale($locale)
									})}
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
								<div
									class="flex items-center gap-1 overflow-x-auto border-b border-border/20 bg-muted/10 px-4 pt-3 pb-0"
								>
									{#each doc.rawFileUrls as _url, idx}
										<button
											type="button"
											onclick={() => (selectedReceptionFileIndex = idx)}
											class="shrink-0 rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-all
												{selectedReceptionFileIndex === idx
												? 'border-primary bg-background text-primary'
												: 'border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground'}"
										>
											<FileText size={11} class="mr-1 inline" />{ui.file}
											{idx + 1}
										</button>
									{/each}
								</div>
							{:else}
								<div
									class="flex items-center gap-2 border-b border-border/20 bg-muted/10 px-4 py-2.5"
								>
									<FileText size={13} class="text-primary" />
									<span class="text-xs font-bold text-muted-foreground"
										>{doc.rawFileUrls[0].split('/').pop()}</span
									>
									<a
										href={doc.rawFileUrls[0]}
										target="_blank"
										class="ml-auto text-[10px] font-bold text-primary/70 hover:text-primary"
										>↗ {ui.openNewTab}</a
									>
								</div>
							{/if}
							<!-- iframe viewer -->
							{#if (doc.rawFileUrls[selectedReceptionFileIndex] ?? doc.rawFileUrls[0]).match(/\.(pdf)$/i)}
								<iframe
									src={doc.rawFileUrls[selectedReceptionFileIndex] ?? doc.rawFileUrls[0]}
									title={ui.file}
									class="h-[480px] w-full border-0"
								></iframe>
							{:else}
								<div class="flex h-[480px] w-full items-center justify-center bg-muted/10 p-4">
									<img
										src={doc.rawFileUrls[selectedReceptionFileIndex] ?? doc.rawFileUrls[0]}
										alt={ui.file}
										class="max-h-full max-w-full rounded-xl object-contain"
									/>
								</div>
							{/if}
							{#if doc.rawFileUrls.length > 1}
								<div
									class="flex items-center justify-end gap-2 border-t border-border/20 bg-muted/5 px-4 py-2"
								>
									<a
										href={doc.rawFileUrls[selectedReceptionFileIndex] ?? doc.rawFileUrls[0]}
										target="_blank"
										class="text-[10px] font-bold text-primary/70 hover:text-primary"
										>↗ {ui.openNewTab}: {ui.file} {selectedReceptionFileIndex + 1}</a
									>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Assignment form -->
					<div class="space-y-6 p-6">
						<!-- AI suggestion -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<div class="text-xs font-black tracking-widest text-muted-foreground uppercase">
									{ui.handlingDepartment} <span class="text-destructive">*</span>
								</div>
								<button
									onclick={() => aiSuggest(doc)}
									disabled={state?.suggestLoading}
									class="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5
										text-xs font-bold text-violet-400 transition-all hover:bg-violet-500/20 disabled:opacity-50"
								>
									{#if state?.suggestLoading}
										<Loader2 size={13} class="animate-spin" /> {ui.askingAi}
									{:else}
										<Brain size={13} /> {ui.aiSuggest}
									{/if}
								</button>
							</div>

							{#if state?.suggestReason}
								<div class="space-y-3">
									{#if state.isValid}
										<div
											class="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[12px] text-emerald-400"
										>
											<CheckCircle2 size={13} class="mt-0.5 shrink-0" />
											<div class="min-w-0">
												<strong>{ui.aiValid}</strong>
												<p class="mt-0.5">{state.suggestReason}</p>
											</div>
										</div>
									{:else}
										<div
											class="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-[12px] text-destructive"
										>
											<AlertCircle size={13} class="mt-0.5 shrink-0" />
											<div class="min-w-0">
												<strong>{ui.aiInvalid}</strong>
												<p class="mt-0.5">{state.suggestReason}</p>
											</div>
										</div>
									{/if}
								</div>
							{/if}

							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								{#each VALID_DEPARTMENTS as dept}
									<label
										class="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 transition-all duration-200
										{state?.dept === dept
											? 'border-primary bg-primary/5'
											: 'border-border/30 hover:border-primary/30 hover:bg-muted/10'}"
									>
										<input
											type="radio"
											name="dept-{doc.id}"
											value={dept}
											checked={state?.dept === dept}
											onchange={() => {
												if (state) {
													state.dept = dept as Department;
													assignmentState = { ...assignmentState };
												}
											}}
											class="sr-only"
										/>
										<div
											class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2
											{state?.dept === dept ? 'border-primary bg-primary' : 'border-muted-foreground/30'}"
										>
											{#if state?.dept === dept}
												<div class="h-1.5 w-1.5 rounded-full bg-primary-foreground"></div>
											{/if}
										</div>
										<div class="min-w-0">
											<p
												class="text-sm leading-tight font-semibold {state?.dept === dept
													? 'text-primary'
													: 'text-foreground'}"
											>
												{getDepartmentLabel(dept as Department, $locale)}
											</p>
										</div>
									</label>
								{/each}
							</div>
						</div>

						<!-- Note/Reason -->
						<div class="space-y-2">
							<label
								for="assign-note-{doc.id}"
								class="text-xs font-black tracking-widest text-muted-foreground uppercase"
							>
								{ui.noteLabel}
							</label>
							<textarea
								id="assign-note-{doc.id}"
								rows={3}
								placeholder={ui.notePlaceholder}
								value={state?.note ?? ''}
								oninput={(e) => {
									if (state) {
										state.note = (e.target as HTMLTextAreaElement).value;
										assignmentState = { ...assignmentState };
									}
								}}
								class="w-full resize-none rounded-2xl border border-border/30 bg-muted/20 px-4 py-3 text-sm
									transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
							></textarea>
						</div>

						<!-- Error -->
						{#if state?.error}
							<div
								class="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-semibold text-destructive"
							>
								<AlertCircle size={15} />
								{state.error}
							</div>
						{/if}

						<!-- Action buttons -->
						{#if state?.assigned}
							<div
								class="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 font-bold text-emerald-400"
							>
								<MailCheck size={18} />
								{ui.assignedSuccess}
							</div>
						{:else if state?.invalidated}
							<div
								class="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 font-bold text-destructive"
							>
								<AlertCircle size={18} />
								{ui.rejectedSuccess}
							</div>
						{:else}
							<div class="flex flex-col gap-3 sm:flex-row">
								<button
									onclick={() => assignDocument(doc)}
									disabled={!state?.dept || state?.assigning || state?.rejecting}
									class="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl
										bg-primary text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/20
										transition-all hover:bg-primary/90 active:scale-[0.98]
										disabled:cursor-not-allowed disabled:opacity-40"
								>
									{#if state?.assigning}
										<Loader2 size={18} class="animate-spin" /> {ui.processing}
									{:else}
										<Building2 size={18} />
										{ui.assignTo}
										{state?.dept ? getDepartmentLabel(state.dept as Department, $locale) : '...'}
									{/if}
								</button>

								<button
									onclick={() => rejectDocument(doc)}
									disabled={state?.assigning || state?.rejecting}
									class="flex h-14 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border
										border-destructive/20 bg-destructive/10 px-6 text-sm font-extrabold text-destructive transition-all hover:bg-destructive/20 active:scale-[0.98]
										disabled:cursor-not-allowed disabled:opacity-40 sm:flex-row"
								>
									{#if state?.rejecting}
										<Loader2 size={16} class="animate-spin" /> {ui.reject}
									{:else}
										{ui.reject}
									{/if}
								</button>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div
					class="flex h-[400px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/30 bg-muted/5 text-center"
				>
					<div class="mb-5 rounded-full border border-border/30 bg-muted/20 p-5">
						<Inbox size={36} class="text-muted-foreground/30" />
					</div>
					<p class="font-bold text-foreground">{ui.selectRecord}</p>
					<p class="mt-1 max-w-xs text-sm text-muted-foreground">
						{ui.selectHint}
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
