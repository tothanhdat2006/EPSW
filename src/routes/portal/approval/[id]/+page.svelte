<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		FileText, CheckCircle2, ChevronRight, Loader2, AlertCircle,
		Brain, ClipboardList, XCircle, Mail
	} from 'lucide-svelte';
	import { format, formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { type DocumentSummary } from '$lib/api/types';

	const id = page.params.id;
	let doc = $state<DocumentSummary | null>(null);
	let isLoading = $state(true);
	let errorMsg = $state('');

	let feedbackText = $state('');
	let decision = $state('APPROVED'); // 'APPROVED' or 'REJECTED'
	let submitting = $state(false);
	let submitted = $state(false);
	let generatingLeaderBrief = $state(false);
	let selectedFileIndex = $state(0);

	async function generateAILeaderBrief() {
		if (!doc) return;
		generatingLeaderBrief = true;
		try {
			const res = await fetch(`/api/documents/${id}/ai-leader-brief`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ decision })
			});
			if (!res.ok) throw new Error(((await res.json()) as any).message || 'Lỗi khi gọi AI');
			const result = await res.json() as { report: string };
			feedbackText = result.report;
		} catch (e) {
			alert((e as Error).message);
		} finally {
			generatingLeaderBrief = false;
		}
	}

	onMount(async () => {
		try {
			const res = await fetch(`/api/documents/${id}`);
			if (!res.ok) throw new Error(((await res.json()) as any).message || 'Không thể tải hồ sơ');
			doc = await res.json();
		} catch (e) {
			errorMsg = (e as Error).message;
		} finally {
			isLoading = false;
		}
	});

	async function submitApproval() {
		if (!doc) return;
		submitting = true;
		try {
			const res = await fetch(`/api/documents/${id}/approve`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ decision, feedback: feedbackText }),
			});
			if (!res.ok) throw new Error(((await res.json()) as any).message || 'Lỗi khi gửi tác vụ');
			doc.status = decision as any;
			submitted = true;
		} catch (e) {
			alert((e as Error).message);
		} finally {
			submitting = false;
		}
	}

	// Helpers
	const officerBrief = $derived((doc?.extractedData as any)?.ai_officer_brief as string | undefined);
	const aiSummary = $derived((doc?.extractedData as any)?.ai_summary as string | undefined);
	const latestOfficerFeedback = $derived(() => {
		const feedbacks: any[] = (doc?.extractedData as any)?.officerFeedback || [];
		return feedbacks.length > 0 ? feedbacks[feedbacks.length - 1] : null;
	});
	const canDecide = $derived(doc?.status === 'PENDING_APPROVAL' && !submitted);
</script>

<svelte:head>
	<title>Phê duyệt hồ sơ — Lãnh đạo</title>
</svelte:head>

<div class="h-full flex flex-col md:flex-row bg-muted/10 animate-in fade-in duration-500 overflow-hidden">

	<!-- Left Panel: Document viewer -->
	<div class="w-full md:w-1/2 flex flex-col border-r border-border/40 bg-background overflow-hidden">
		<!-- Header -->
		<div class="p-6 border-b border-border/30 bg-muted/10">
			<div class="flex items-center gap-2 mb-4">
				<a href="/portal" class="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
					<ChevronRight size={14} class="rotate-180" /> Quay lại
				</a>
				<span class="text-border/50">•</span>
				<span class="text-[10px] font-black uppercase tracking-widest text-primary">Phê duyệt cấp Lãnh đạo</span>
			</div>

			{#if isLoading}
				<div class="space-y-3">
					<div class="h-4 w-32 bg-muted/40 animate-pulse rounded"></div>
					<div class="h-8 w-64 bg-muted/40 animate-pulse rounded"></div>
				</div>
			{:else if doc}
				<div class="space-y-1">
					<p class="font-mono text-xs font-bold text-primary tracking-[0.2em] uppercase">{doc.trackingCode}</p>
					<h2 class="text-xl font-extrabold text-foreground flex items-center gap-3">
						Hồ sơ gốc
						<StatusBadge status={doc.status} />
					</h2>
				</div>
			{:else if errorMsg}
				<p class="text-destructive font-bold">{errorMsg}</p>
			{/if}
		</div>

		<!-- File viewer -->
		<div class="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
			{#if doc?.rawFileUrls && doc.rawFileUrls.length > 0}
				{#if doc.rawFileUrls.length > 1}
					<div class="flex bg-muted/30 p-1.5 rounded-xl w-fit gap-1">
						{#each doc.rawFileUrls as url, idx}
							<button 
								class="px-4 py-2 rounded-lg text-xs font-bold transition-all {selectedFileIndex === idx ? 'bg-background shadow-md text-primary ring-1 ring-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
								onclick={() => selectedFileIndex = idx}
							>
								Tệp {idx + 1}
							</button>
						{/each}
					</div>
				{/if}

				{@const currentUrl = doc.rawFileUrls[selectedFileIndex] || doc.rawFileUrls[0]}
				<div class="rounded-2xl border border-border/50 overflow-hidden flex flex-col h-full bg-muted/5 min-h-[400px]">
					<div class="border-b border-border/50 bg-background/50 p-3 flex items-center justify-between">
						<span class="text-xs font-bold text-foreground flex items-center gap-2">
							<FileText size={16} class="text-blue-500" />
							{currentUrl.split('/').pop()}
						</span>
						<a href={currentUrl} target="_blank" class="text-xs font-bold text-blue-500 hover:text-blue-600 px-3 py-1 bg-blue-500/10 rounded-lg">Mở toàn màn hình</a>
					</div>
					<iframe src={currentUrl} class="w-full flex-1 border-0 min-h-[600px]" title="Document Viewer"></iframe>
				</div>
			{/if}
		</div>
	</div>

	<!-- Right Panel: Decision -->
	<div class="w-full md:w-1/2 flex flex-col bg-background overflow-y-auto shadow-[-10px_0_30px_rgba(0,0,0,0.02)] relative z-10">
		{#if doc}
			<div class="p-8 max-w-2xl mx-auto w-full space-y-8">

				<!-- ── Officer Brief (AI) ── -->
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<div class="p-1.5 rounded bg-primary/10 text-primary">
							<Brain size={16} />
						</div>
						<h3 class="text-xs font-black text-foreground tracking-widest uppercase">Tóm tắt báo cáo Chuyên viên (AI)</h3>
					</div>

					<div class="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-relaxed text-foreground font-medium relative overflow-hidden">
						{#if officerBrief}
							{officerBrief}
						{:else if aiSummary}
							<!-- Fallback to document AI summary if officer brief not yet ready -->
							<p class="text-muted-foreground italic text-xs mb-2 font-sans">(Tóm tắt tài liệu — báo cáo Chuyên viên đang được AI xử lý)</p>
							{aiSummary}
						{:else}
							<p class="text-muted-foreground/60 italic text-xs">Chưa có báo cáo tổng hợp.</p>
						{/if}
						<!-- Shimmer if awaiting -->
						{#if !officerBrief && doc.status === 'PENDING_APPROVAL'}
							<div class="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent animate-pulse"></div>
						{/if}
					</div>
				</div>

				<!-- ── Chuyên viên's Biên bản ── -->
				{#if latestOfficerFeedback()}
					{@const fb = latestOfficerFeedback()}
					<div class="space-y-3">
						<div class="flex items-center gap-2">
							<div class="p-1.5 rounded bg-amber-500/10 text-amber-500">
								<ClipboardList size={16} />
							</div>
							<h3 class="text-xs font-black text-foreground tracking-widest uppercase">Biên bản xử lý chuyên môn</h3>
						</div>

						<div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
							<div class="flex items-center justify-between gap-4">
								<div class="flex items-center gap-2">
									<span class="text-xs font-bold text-foreground">{fb.officer}</span>
									<span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">Chuyên viên</span>
								</div>
								<div class="flex items-center gap-2">
									{#if fb.decision === 'APPROVE'}
										<span class="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
											<CheckCircle2 size={10} /> Đề nghị Phê duyệt
										</span>
									{:else}
										<span class="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
											<AlertCircle size={10} /> Yêu cầu Sửa đổi
										</span>
									{/if}
									<span class="text-[10px] text-muted-foreground">
										{format(new Date(fb.timestamp * 1000), "HH:mm dd/MM/yyyy")}
									</span>
								</div>
							</div>
							<p class="text-sm text-foreground leading-relaxed font-mono whitespace-pre-wrap border-t border-amber-500/10 pt-3">
								{fb.feedback || '(Không có nội dung biên bản)'}
							</p>
						</div>
					</div>
				{/if}

				<!-- ── Tờ trình Liên ngành (from ai-summary) ── -->
				{#if aiSummary}
					<div class="space-y-3">
						<h3 class="text-xs font-black text-muted-foreground tracking-widest uppercase">Tờ trình Liên ngành (AI Tổng hợp)</h3>
						<div class="rounded-2xl border border-border/30 bg-muted/10 p-5 font-sans text-sm leading-relaxed text-foreground">
							{aiSummary}
						</div>
					</div>
				{/if}

				<div class="h-px bg-border/40 w-full"></div>

				<!-- ── Decision Form ── -->
				<div class="space-y-6">
					<div class="space-y-1">
						<h3 class="text-sm font-extrabold text-foreground tracking-tight uppercase">Quyết định của Lãnh đạo</h3>
						<p class="text-xs text-muted-foreground leading-relaxed">
							Kết quả sẽ được thông báo đến công dân qua email ngay sau khi Lãnh đạo chốt quyết định.
						</p>
					</div>

					{#if canDecide}
						<div class="space-y-5">
							<!-- Decision radio cards -->
							<div class="grid grid-cols-3 gap-3">
								<label class="cursor-pointer">
									<input type="radio" name="decision" value="APPROVED" bind:group={decision} class="sr-only" />
									<div class="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border transition-all text-center
										{decision === 'APPROVED'
											? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/50 text-emerald-600'
											: 'border-border/60 hover:bg-muted/30 text-muted-foreground'}">
										<CheckCircle2 size={26} />
										<span class="text-xs font-extrabold leading-tight">Phê duyệt</span>
										<span class="text-[10px] opacity-70">Đồng ý đề xuất</span>
									</div>
								</label>
								<label class="cursor-pointer">
									<input type="radio" name="decision" value="REVISION_REQUESTED" bind:group={decision} class="sr-only" />
									<div class="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border transition-all text-center
										{decision === 'REVISION_REQUESTED'
											? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50 text-amber-600'
											: 'border-border/60 hover:bg-muted/30 text-muted-foreground'}">
										<AlertCircle size={26} />
										<span class="text-xs font-extrabold leading-tight">Sửa đổi</span>
										<span class="text-[10px] opacity-70">Yêu cầu bổ sung nội dung</span>
									</div>
								</label>
								<label class="cursor-pointer">
									<input type="radio" name="decision" value="REJECTED" bind:group={decision} class="sr-only" />
									<div class="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border transition-all text-center
										{decision === 'REJECTED'
											? 'border-destructive bg-destructive/10 ring-1 ring-destructive/50 text-destructive'
											: 'border-border/60 hover:bg-muted/30 text-muted-foreground'}">
										<XCircle size={26} />
										<span class="text-xs font-extrabold leading-tight">Từ chối</span>
										<span class="text-[10px] opacity-70">Không đạt yêu cầu</span>
									</div>
								</label>
							</div>

							<!-- Remarks -->
							<div class="space-y-2">
								<div class="flex items-center justify-between gap-3">
									<label for="ld-feedback" class="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
										Ý kiến chỉ đạo {(decision === 'REJECTED' || decision === 'REVISION_REQUESTED') ? '(bắt buộc)' : '(tùy chọn)'}
									</label>
									<button
										onclick={generateAILeaderBrief}
										disabled={generatingLeaderBrief}
										class="shrink-0 flex items-center gap-2 text-xs font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
									>
										{#if generatingLeaderBrief}
											<Loader2 size={14} class="animate-spin" /> Đang soạn...
										{:else}
											<Brain size={14} /> AI Soạn thảo
										{/if}
									</button>
								</div>
								<textarea
									id="ld-feedback"
									bind:value={feedbackText}
									rows={4}
									placeholder={decision === 'APPROVED'
										? 'Đồng ý phê duyệt theo đề xuất của Chuyên viên...'
										: 'Nhấn "AI Soạn thảo" để tự động điền ý kiến...'}
									class="w-full rounded-2xl bg-muted/10 border border-border/50 px-4 py-3 text-sm font-mono resize-y
										focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all shadow-sm"
								></textarea>
							</div>

							<!-- Submit -->
							<button
								onclick={submitApproval}
								disabled={submitting || ((decision === 'REJECTED' || decision === 'REVISION_REQUESTED') && !feedbackText.trim())}
								class="w-full h-14 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/5
									{decision === 'APPROVED' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : decision === 'REJECTED' ? 'bg-destructive hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-black'}
									disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
							>
								{#if submitting}
									<Loader2 size={18} class="animate-spin" /> Đang xử lý...
								{:else if decision === 'APPROVED'}
									<CheckCircle2 size={18} /> Phê duyệt & Thông báo Công dân
								{:else if decision === 'REJECTED'}
									<XCircle size={18} /> Từ chối & Gửi email Thông báo
								{:else}
									<AlertCircle size={18} /> Yêu cầu sửa đổi hồ sơ
								{/if}
							</button>

							{#if decision === 'APPROVED'}
								<p class="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
									<Mail size={11} class="text-primary" />
									Hệ thống sẽ tự động gửi email xác nhận phê duyệt đến công dân.
								</p>
							{:else if decision === 'REJECTED'}
								<p class="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
									<Mail size={11} class="text-destructive" />
									Hệ thống sẽ tự động gửi email thông báo từ chối kèm lý do đến công dân.
								</p>
							{:else}
								<p class="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
									Hồ sơ sẽ được chuyển lại cho Chuyên viên để tiến hành sửa đổi.
								</p>
							{/if}
						</div>

					{:else if submitted || (doc.status === 'APPROVED' || doc.status === 'REJECTED' || doc.status === 'REVISION_REQUESTED')}
						<!-- Post-decision state -->
						{@const isApproved = doc.status === 'APPROVED'}
						{@const isRejected = doc.status === 'REJECTED'}
						<div class="flex items-center gap-4 p-6 rounded-2xl border
							{isApproved
								? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
								: isRejected ? 'bg-destructive/10 border-destructive/20 text-destructive'
								: 'bg-amber-500/10 border-amber-500/20 text-amber-600'}">
							{#if isApproved}
								<CheckCircle2 size={28} />
								<div>
									<p class="font-extrabold">Hồ sơ đã được Phê duyệt</p>
									<p class="text-xs font-medium opacity-80 mt-0.5 flex items-center gap-1">
										<Mail size={11} /> Email xác nhận đã gửi đến công dân.
									</p>
									<a href="/portal" class="block mt-2 text-xs font-semibold underline underline-offset-4 opacity-70 hover:opacity-100">Quay về Mission Control</a>
								</div>
							{:else if isRejected}
								<XCircle size={28} />
								<div>
									<p class="font-extrabold">Hồ sơ đã bị Từ chối</p>
									<p class="text-xs font-medium opacity-80 mt-0.5 flex items-center gap-1">
										<Mail size={11} /> Email thông báo đã gửi đến công dân.
									</p>
									<a href="/portal" class="block mt-2 text-xs font-semibold underline underline-offset-4 opacity-70 hover:opacity-100">Quay về Mission Control</a>
								</div>
							{:else}
								<AlertCircle size={28} />
								<div>
									<p class="font-extrabold">Hồ sơ được yêu cầu Sửa đổi</p>
									<p class="text-xs font-medium opacity-80 mt-0.5">
										Trạng thái hồ sơ đã được chuyển lại cho Chuyên viên.
									</p>
									<a href="/portal" class="block mt-2 text-xs font-semibold underline underline-offset-4 opacity-70 hover:opacity-100">Quay về Mission Control</a>
								</div>
							{/if}
						</div>

					{:else}
						<!-- Not in PENDING_APPROVAL state -->
						<div class="flex items-center gap-3 p-5 rounded-2xl border bg-muted/10 border-border/50 text-muted-foreground font-bold">
							<CheckCircle2 size={24} />
							<div>
								Hồ sơ chưa được Chuyên viên trình duyệt.
								<a href="/portal" class="block mt-1 text-xs font-semibold underline underline-offset-4 decoration-border">Quay về Mission Control</a>
							</div>
						</div>
					{/if}
				</div>

			</div>
		{:else if isLoading}
			<div class="flex-1 flex items-center justify-center">
				<Loader2 size={32} class="animate-spin text-primary" />
			</div>
		{:else if errorMsg}
			<div class="flex-1 flex items-center justify-center p-8">
				<p class="text-destructive font-bold">{errorMsg}</p>
			</div>
		{/if}
	</div>
</div>
