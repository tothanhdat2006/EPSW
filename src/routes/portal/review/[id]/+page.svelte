<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { FileText, Building2, CheckCircle2, ChevronRight, Loader2, AlertCircle, Info, Brain, RefreshCw, Reply, X } from 'lucide-svelte';
	import { format, formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import {
		DEPARTMENT_LABELS, type Department, type DocumentSummary
	} from '$lib/api/types';

	const id = page.params.id;
	let doc = $state<DocumentSummary | null>(null);
	let isLoading = $state(true);
	let errorMsg = $state('');

	let feedbackText = $state('');
	let decision = $state('APPROVE'); // 'APPROVE' or 'REVISION_REQUESTED'
	let aiDrafting = $state(false);
	let selectedFileIndex = $state(0);
	let submitting = $state(false);

	onMount(async () => {
		try {
			const res = await fetch(`/api/documents/${id}`);
			if (!res.ok) {
				const errData = await res.json() as any;
				throw new Error(errData.message || 'Không thể tải hồ sơ');
			}
			doc = await res.json();
		} catch (e) {
			errorMsg = (e as Error).message;
		} finally {
			isLoading = false;
		}
	});

	async function submitReview() {
		if (!doc) return;
		submitting = true;
		try {
			const res = await fetch(`/api/documents/${id}/review`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ decision, feedback: feedbackText }),
			});
			if (!res.ok) throw new Error(((await res.json()) as any).message || 'Lỗi khi gửi đánh giá');
			
			// Refresh state
			doc.status = 'PENDING_APPROVAL';
		} catch (e) {
			alert((e as Error).message);
		} finally {
			submitting = false;
		}
	}
	let generatingAI = $state(false);
	let generatingReport = $state(false);

	async function generateAISummary() {
		if (!doc) return;
		generatingAI = true;
		try {
			const res = await fetch(`/api/documents/${id}/ai-summary`, { method: 'POST' });
			if (!res.ok) {
				const err = await res.json() as any;
				throw new Error(err.message || 'Lỗi khi gọi AI');
			}
			const result = await res.json() as any;
			
			if (doc.extractedData) {
				doc.extractedData.ai_summary = result.ai_summary;
			} else {
				doc.extractedData = { ai_summary: result.ai_summary };
			}
		} catch (e) {
			alert((e as Error).message);
		} finally {
			generatingAI = false;
		}
	}

	let newCommentText = $state('');
	let isPostingComment = $state(false);
	let replyingTo = $state<any>(null);

	async function postComment() {
		if (!doc || !newCommentText.trim()) return;
		isPostingComment = true;
		try {
			const res = await fetch(`/api/documents/${id}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					text: newCommentText,
					replyTo: replyingTo ? {
						id: replyingTo.id,
						author: replyingTo.author,
						textSnippet: replyingTo.text.length > 50 ? replyingTo.text.substring(0, 50) + '...' : replyingTo.text
					} : undefined
				})
			});
			if (!res.ok) {
				const err = await res.json() as any;
				throw new Error(err.message || 'Lỗi khi gửi bình luận');
			}
			const result = await res.json() as any;
			if (!doc.extractedData) doc.extractedData = {};
			const ed = doc.extractedData as any;
			if (!ed.comments) ed.comments = [];
			ed.comments.push(result.comment);
			newCommentText = '';
			replyingTo = null;
		} catch (e) {
			alert((e as Error).message);
		} finally {
			isPostingComment = false;
		}
	}

	async function generateAIReport() {
		if (!doc) return;
		generatingReport = true;
		try {
			const res = await fetch(`/api/documents/${id}/ai-report`, { method: 'POST' });
			if (!res.ok) {
				const err = await res.json() as any;
				throw new Error(err.message || 'Lỗi khi gọi AI');
			}
			const result = await res.json() as { report: string; recommendation: string };
			feedbackText = result.report;
			decision = result.recommendation === 'REVISION_REQUESTED' ? 'REVISION_REQUESTED' : 'APPROVE';
		} catch (e) {
			alert((e as Error).message);
		} finally {
			generatingReport = false;
		}
	}
</script>

<svelte:head>
	<title>Kiểm duyệt hồ sơ — Cán bộ DVC</title>
</svelte:head>

<div class="h-full flex flex-col md:flex-row bg-muted/10 animate-in fade-in duration-500 overflow-hidden">
	
	<!-- Left Panel: Context -->
	<div class="w-full md:w-1/2 flex flex-col border-r border-border/40 bg-background overflow-hidden">
		<!-- Header -->
		<div class="p-6 border-b border-border/30 bg-muted/10">
			<div class="flex items-center gap-2 mb-4">
				<a href="/portal" class="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
					<ChevronRight size={14} class="rotate-180" /> Quay lại
				</a>
				<span class="text-border/50">•</span>
				<span class="text-[10px] font-black uppercase tracking-widest text-primary">Kiểm duyệt hồ sơ</span>
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

		<!-- File viewer / Context -->
		<div class="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
			{#if doc?.rawFileUrls && doc.rawFileUrls.length > 0}
				<!-- Tabs for multiple files -->
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
				<!-- Attachment box -->
				<div class="rounded-2xl border border-border/50 overflow-hidden flex flex-col h-full bg-muted/5 min-h-[400px]">
					<div class="border-b border-border/50 bg-background/50 p-3 flex items-center justify-between">
						<span class="text-xs font-bold text-foreground flex items-center gap-2">
							<FileText size={16} class="text-blue-500" />
							{currentUrl.split('/').pop()}
						</span>
						<a href={currentUrl} target="_blank" class="text-xs font-bold text-blue-500 hover:text-blue-600 px-3 py-1 bg-blue-500/10 rounded-lg">Mở toàn màn hình</a>
					</div>
					<!-- Iframe preview if applicable -->
					<iframe src={currentUrl} class="w-full flex-1 border-0 min-h-[600px]" title="Document Viewer"></iframe>
				</div>
			{/if}
		</div>
	</div>

	<!-- Right Panel: AI & Submission -->
	<div class="w-full md:w-1/2 flex flex-col bg-background overflow-y-auto shadow-[-10px_0_30px_rgba(0,0,0,0.02)] relative z-10">
		{#if doc}
			<div class="p-8 max-w-2xl mx-auto w-full space-y-8">
				
				<!-- AI Summary Block -->
				<div class="space-y-4">
					<div class="flex items-center justify-between gap-4">
						<div class="flex items-center gap-2">
							<div class="p-1.5 rounded bg-primary/10 text-primary">
								<Brain size={18} />
							</div>
							<h3 class="text-sm font-extrabold text-foreground tracking-tight uppercase">Tờ trình Liên ngành (AI Tổng hợp)</h3>
						</div>
						<div class="flex items-center gap-2">
							{#if doc.extractedData?.ai_summary}
								<button 
									onclick={generateAISummary}
									disabled={generatingAI}
									class="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 flex items-center gap-1.5 bg-muted/20 hover:bg-primary/10 px-2.5 py-1 rounded-md border border-border/40 hover:border-primary/20"
								>
									{#if generatingAI}
										<Loader2 size={12} class="animate-spin" /> Đang tạo...
									{:else}
										<RefreshCw size={12} /> Tạo lại
									{/if}
								</button>
							{:else}
								<button 
									onclick={generateAISummary}
									disabled={generatingAI}
									class="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
								>
									{#if generatingAI}
										<Loader2 size={14} class="animate-spin" /> Đang tạo...
									{:else}
										Tổng hợp AI
									{/if}
								</button>
							{/if}
						</div>
					</div>

					<div class="rounded-2xl border border-primary/20 bg-primary/5 p-5 relative overflow-hidden shadow-inner font-sans font-medium text-sm leading-relaxed text-foreground">
						{#if doc.extractedData?.ai_summary}
							{doc.extractedData.ai_summary}
						{:else}
							<div class="flex items-center gap-3 text-muted-foreground/60 italic font-sans text-xs">
								Hệ thống chưa tổng hợp AI. Hãy bấm nút phía trên để tạo.
							</div>
						{/if}
					</div>
				</div>

				<!-- Discussion Section -->
				<div class="space-y-4 pt-6 border-t border-border/40">
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-extrabold text-foreground tracking-tight uppercase">Thảo luận / Góp ý</h3>
					</div>
					
					<div class="space-y-3">
						{#each (doc.extractedData as any)?.comments || [] as comment}
							<div class="p-3 rounded-xl bg-muted/20 border border-border/30">
								<div class="flex items-center justify-between gap-4 mb-2">
									<div class="flex items-center gap-2">
										<span class="font-bold text-xs text-foreground">{comment.author}</span>
										<span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
											{comment.role === 'lanh_dao' ? 'Lãnh đạo' : (comment.role === 'chuyen_vien' ? 'Chuyên viên' : comment.role)}
										</span>
									</div>
									<span class="text-[10px] text-muted-foreground flex items-center gap-2">
										{formatDistanceToNow(new Date(comment.timestamp * 1000), { addSuffix: true, locale: vi })}
										<button 
											onclick={() => replyingTo = comment} 
											class="text-primary hover:underline flex items-center gap-1 font-bold ml-1"
										>
											<Reply size={10} /> Trả lời
										</button>
									</span>
								</div>
								
								{#if comment.replyTo}
									<div class="border-l-2 border-primary/30 pl-2 ml-1 mb-2">
										<p class="text-[10px] text-muted-foreground font-medium mb-0.5">Trả lời <span class="font-bold text-foreground">{comment.replyTo.author}</span>:</p>
										<p class="text-xs text-muted-foreground/80 italic line-clamp-1">{comment.replyTo.textSnippet}</p>
									</div>
								{/if}

								<p class="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{comment.text}</p>
							</div>
						{/each}
						
						{#if ((doc.extractedData as any)?.comments || []).length === 0}
							<div class="text-xs text-muted-foreground italic text-center py-4">Chưa có bình luận nào.</div>
						{/if}
					</div>

					{#if replyingTo}
						<div class="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-2.5 mb-1 animate-in slide-in-from-bottom-2 duration-300">
							<div class="flex-1 min-w-0 pr-4">
								<p class="text-[10px] font-bold text-primary mb-0.5 flex items-center gap-1"><Reply size={10} /> Đang trả lời {replyingTo.author}</p>
								<p class="text-xs text-muted-foreground truncate italic">{replyingTo.text}</p>
							</div>
							<button onclick={() => replyingTo = null} class="text-muted-foreground hover:text-destructive transition-colors p-1" title="Hủy trả lời">
								<X size={14} />
							</button>
						</div>
					{/if}
					<form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); postComment(); }}>
						<input type="text" bind:value={newCommentText} placeholder="Nhập bình luận..." class="flex-1 rounded-xl bg-background border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
						<button type="submit" disabled={isPostingComment || !newCommentText.trim()} class="px-4 h-10 bg-primary/10 text-primary font-bold text-sm rounded-xl hover:bg-primary/20 disabled:opacity-50 transition-colors">Gửi</button>
					</form>
				</div>

				<div class="h-px bg-border/40 w-full"></div>

				<!-- Review Form -->
				<div class="space-y-6">
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-3">
							<div>
								<h3 class="text-sm font-extrabold text-foreground tracking-tight uppercase">Biên bản xử lý chuyên môn</h3>
								<p class="text-xs text-muted-foreground leading-relaxed">Bộ phận chuyên môn nhập ý kiến đánh giá, làm cơ sở để Lãnh đạo ra Quyết định cuối cùng.</p>
							</div>
							<button
								onclick={generateAIReport}
								disabled={generatingReport}
								class="shrink-0 flex items-center gap-2 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
							>
								{#if generatingReport}
									<Loader2 size={14} class="animate-spin" /> Đang soạn...
								{:else}
									<Brain size={14} /> AI Soạn thảo
								{/if}
							</button>
						</div>
					</div>

					<!-- Form -->
					{#if doc.status === 'ASSIGNED'}
						<div class="space-y-5">
							<!-- Decision Select -->
							<div class="space-y-2">
								<label for="decision" class="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Đề xuất lên Lãnh đạo</label>
								<div class="grid grid-cols-2 gap-3">
									<label class="cursor-pointer">
										<input type="radio" name="decision" value="APPROVE" bind:group={decision} class="sr-only" />
										<div class="flex items-center gap-3 p-4 rounded-xl border transition-all {decision === 'APPROVE' ? 'border-primary bg-primary/10 ring-1 ring-primary/50' : 'border-border/60 hover:bg-muted/30'}">
											<CheckCircle2 size={18} class={decision === 'APPROVE' ? 'text-primary' : 'text-muted-foreground'} />
											<span class="text-sm font-bold {decision === 'APPROVE' ? 'text-primary' : 'text-foreground'}">Đề nghị Phê duyệt</span>
										</div>
									</label>
									<label class="cursor-pointer">
										<input type="radio" name="decision" value="REVISION_REQUESTED" bind:group={decision} class="sr-only" />
										<div class="flex items-center gap-3 p-4 rounded-xl border transition-all {decision === 'REVISION_REQUESTED' ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50' : 'border-border/60 hover:bg-muted/30'}">
											<AlertCircle size={18} class={decision === 'REVISION_REQUESTED' ? 'text-amber-500' : 'text-muted-foreground'} />
											<span class="text-sm font-bold {decision === 'REVISION_REQUESTED' ? 'text-amber-500' : 'text-foreground'}">Yêu cầu Sửa đổi</span>
										</div>
									</label>
								</div>
							</div>

							<!-- Feedback Text -->
							<div class="space-y-2">
								<label for="feedback" class="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
									Ý kiến
								</label>
								<textarea
									id="feedback"
									bind:value={feedbackText}
									rows={10}
									placeholder="Nhập ý kiến chuyên môn, hoặc nhấn 'AI Soạn thảo' để AI tự động soạn Biên bản..."
									class="w-full rounded-2xl bg-muted/10 border border-border/50 px-4 py-3 text-sm font-mono resize-y leading-relaxed
										focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all shadow-sm"
								></textarea>
							</div>

							<!-- Submit Button -->
							<button
								onclick={submitReview}
								disabled={submitting || !feedbackText.trim()}
								class="w-full h-14 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/5
									{decision === 'APPROVE' 
										? 'bg-primary text-primary-foreground hover:bg-primary/90' 
										: 'bg-amber-500 text-black hover:bg-amber-400'}
									disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
							>
								{#if submitting}
									<Loader2 size={18} class="animate-spin" /> Đang chuyển hồ sơ...
								{:else}
									Chuyển Lãnh đạo phê duyệt
								{/if}
							</button>
						</div>
					{:else}
						<div class="flex items-center gap-3 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
							<CheckCircle2 size={24} />
							<div>
								Hồ sơ đã được chuyển lên Lãnh đạo thành công.
								<a href="/portal" class="block mt-1 text-xs font-semibold underline underline-offset-4 decoration-emerald-500/40 hover:decoration-emerald-500">Quay về trang chủ</a>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
