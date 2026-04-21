<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		FileText,
		Building2,
		CheckCircle2,
		ChevronRight,
		Loader2,
		AlertCircle,
		Info,
		Brain,
		RefreshCw,
		Reply,
		X
	} from 'lucide-svelte';
	import { format, formatDistanceToNow } from 'date-fns';
	import { getDateLocale, locale } from '$lib/i18n';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { DEPARTMENT_LABELS, type Department, type DocumentSummary } from '$lib/api/types';

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
				const errData = (await res.json()) as any;
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
				body: JSON.stringify({ decision, feedback: feedbackText })
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
				const err = (await res.json()) as any;
				throw new Error(err.message || 'Lỗi khi gọi AI');
			}
			const result = (await res.json()) as any;

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

	const ui = $derived(
		$locale === 'en'
			? {
					title: 'Record Review',
					back: 'Back',
					reviewBadge: 'Record Review',
					originalRecord: 'Original Record',
					file: 'File',
					openFullscreen: 'Open fullscreen',
					aiSummaryTitle: 'Inter-agency Memo (AI Summary)',
					generating: 'Generating...',
					regenerate: 'Regenerate',
					aiSummary: 'AI Summary',
					noAiSummary:
						'The system has not generated the AI summary yet. Press the button above to create it.',
					discussion: 'Discussion / Feedback',
					leadershipRole: 'Leadership',
					officerRole: 'Officer',
					reply: 'Reply',
					noComments: 'No comments yet.',
					replyingTo: 'Replying to',
					cancelReply: 'Cancel reply',
					commentPlaceholder: 'Enter a comment...',
					send: 'Send',
					reviewMinutes: 'Professional Review Minutes',
					reviewHint:
						'The specialist team enters their assessment to support the final leadership decision.',
					aiDraft: 'AI Draft',
					drafting: 'Drafting...',
					proposal: 'Proposal to Leadership',
					recommendApprove: 'Recommend Approval',
					requestRevision: 'Request Revision',
					opinion: 'Opinion',
					opinionPlaceholder:
						"Enter the professional opinion, or press 'AI Draft' to generate the review minutes automatically...",
					forwarding: 'Forwarding record...',
					forwardForApproval: 'Forward to Leadership for Approval',
					successForwarded: 'The record has been forwarded to leadership successfully.',
					backHome: 'Back to home'
				}
			: {
					title: 'Kiểm duyệt hồ sơ',
					back: 'Quay lại',
					reviewBadge: 'Kiểm duyệt hồ sơ',
					originalRecord: 'Hồ sơ gốc',
					file: 'Tệp',
					openFullscreen: 'Mở toàn màn hình',
					aiSummaryTitle: 'Tờ trình Liên ngành (AI Tổng hợp)',
					generating: 'Đang tạo...',
					regenerate: 'Tạo lại',
					aiSummary: 'Tổng hợp AI',
					noAiSummary: 'Hệ thống chưa tổng hợp AI. Hãy bấm nút phía trên để tạo.',
					discussion: 'Thảo luận / Góp ý',
					leadershipRole: 'Lãnh đạo',
					officerRole: 'Chuyên viên',
					reply: 'Trả lời',
					noComments: 'Chưa có bình luận nào.',
					replyingTo: 'Đang trả lời',
					cancelReply: 'Hủy trả lời',
					commentPlaceholder: 'Nhập bình luận...',
					send: 'Gửi',
					reviewMinutes: 'Biên bản xử lý chuyên môn',
					reviewHint:
						'Bộ phận chuyên môn nhập ý kiến đánh giá, làm cơ sở để Lãnh đạo ra Quyết định cuối cùng.',
					aiDraft: 'AI Soạn thảo',
					drafting: 'Đang soạn...',
					proposal: 'Đề xuất lên Lãnh đạo',
					recommendApprove: 'Đề nghị Phê duyệt',
					requestRevision: 'Yêu cầu Sửa đổi',
					opinion: 'Ý kiến',
					opinionPlaceholder:
						"Nhập ý kiến chuyên môn, hoặc nhấn 'AI Soạn thảo' để AI tự động soạn Biên bản...",
					forwarding: 'Đang chuyển hồ sơ...',
					forwardForApproval: 'Chuyển Lãnh đạo phê duyệt',
					successForwarded: 'Hồ sơ đã được chuyển lên Lãnh đạo thành công.',
					backHome: 'Quay về trang chủ'
				}
	);

	async function postComment() {
		if (!doc || !newCommentText.trim()) return;
		isPostingComment = true;
		try {
			const res = await fetch(`/api/documents/${id}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: newCommentText,
					replyTo: replyingTo
						? {
								id: replyingTo.id,
								author: replyingTo.author,
								textSnippet:
									replyingTo.text.length > 50
										? replyingTo.text.substring(0, 50) + '...'
										: replyingTo.text
							}
						: undefined
				})
			});
			if (!res.ok) {
				const err = (await res.json()) as any;
				throw new Error(err.message || 'Lỗi khi gửi bình luận');
			}
			const result = (await res.json()) as any;
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
				const err = (await res.json()) as any;
				throw new Error(err.message || 'Lỗi khi gọi AI');
			}
			const result = (await res.json()) as { report: string; recommendation: string };
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
	<title>{ui.title} — DVC Portal</title>
</svelte:head>

<div
	class="flex h-full animate-in flex-col overflow-hidden bg-muted/10 duration-500 fade-in md:flex-row"
>
	<!-- Left Panel: Context -->
	<div
		class="flex w-full flex-col overflow-hidden border-r border-border/40 bg-background md:w-1/2"
	>
		<!-- Header -->
		<div class="border-b border-border/30 bg-muted/10 p-6">
			<div class="mb-4 flex items-center gap-2">
				<a
					href="/portal"
					class="flex items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
				>
					<ChevronRight size={14} class="rotate-180" />
					{ui.back}
				</a>
				<span class="text-border/50">•</span>
				<span class="text-[10px] font-black tracking-widest text-primary uppercase"
					>{ui.reviewBadge}</span
				>
			</div>

			{#if isLoading}
				<div class="space-y-3">
					<div class="h-4 w-32 animate-pulse rounded bg-muted/40"></div>
					<div class="h-8 w-64 animate-pulse rounded bg-muted/40"></div>
				</div>
			{:else if doc}
				<div class="space-y-1">
					<p class="font-mono text-xs font-bold tracking-[0.2em] text-primary uppercase">
						{doc.trackingCode}
					</p>
					<h2 class="flex items-center gap-3 text-xl font-extrabold text-foreground">
						{ui.originalRecord}
						<StatusBadge status={doc.status} />
					</h2>
				</div>
			{:else if errorMsg}
				<p class="font-bold text-destructive">{errorMsg}</p>
			{/if}
		</div>

		<!-- File viewer / Context -->
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
			{#if doc?.rawFileUrls && doc.rawFileUrls.length > 0}
				<!-- Tabs for multiple files -->
				{#if doc.rawFileUrls.length > 1}
					<div class="flex w-fit gap-1 rounded-xl bg-muted/30 p-1.5">
						{#each doc.rawFileUrls as url, idx}
							<button
								class="rounded-lg px-4 py-2 text-xs font-bold transition-all {selectedFileIndex ===
								idx
									? 'bg-background text-primary shadow-md ring-1 ring-primary/20'
									: 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'}"
								onclick={() => (selectedFileIndex = idx)}
							>
								{ui.file}
								{idx + 1}
							</button>
						{/each}
					</div>
				{/if}

				{@const currentUrl = doc.rawFileUrls[selectedFileIndex] || doc.rawFileUrls[0]}
				<!-- Attachment box -->
				<div
					class="flex h-full min-h-[400px] flex-col overflow-hidden rounded-2xl border border-border/50 bg-muted/5"
				>
					<div
						class="flex items-center justify-between border-b border-border/50 bg-background/50 p-3"
					>
						<span class="flex items-center gap-2 text-xs font-bold text-foreground">
							<FileText size={16} class="text-blue-500" />
							{currentUrl.split('/').pop()}
						</span>
						<a
							href={currentUrl}
							target="_blank"
							class="rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-500 hover:text-blue-600"
							>{ui.openFullscreen}</a
						>
					</div>
					<!-- Iframe preview if applicable -->
					<iframe
						src={currentUrl}
						class="min-h-[600px] w-full flex-1 border-0"
						title="Document Viewer"
					></iframe>
				</div>
			{/if}
		</div>
	</div>

	<!-- Right Panel: AI & Submission -->
	<div
		class="relative z-10 flex w-full flex-col overflow-y-auto bg-background shadow-[-10px_0_30px_rgba(0,0,0,0.02)] md:w-1/2"
	>
		{#if doc}
			<div class="mx-auto w-full max-w-2xl space-y-8 p-8">
				<!-- AI Summary Block -->
				<div class="space-y-4">
					<div class="flex items-center justify-between gap-4">
						<div class="flex items-center gap-2">
							<div class="rounded bg-primary/10 p-1.5 text-primary">
								<Brain size={18} />
							</div>
							<h3 class="text-sm font-extrabold tracking-tight text-foreground uppercase">
								{ui.aiSummaryTitle}
							</h3>
						</div>
						<div class="flex items-center gap-2">
							{#if doc.extractedData?.ai_summary}
								<button
									onclick={generateAISummary}
									disabled={generatingAI}
									class="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/10 hover:text-primary disabled:opacity-50"
								>
									{#if generatingAI}
										<Loader2 size={12} class="animate-spin" /> {ui.generating}
									{:else}
										<RefreshCw size={12} /> {ui.regenerate}
									{/if}
								</button>
							{:else}
								<button
									onclick={generateAISummary}
									disabled={generatingAI}
									class="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
								>
									{#if generatingAI}
										<Loader2 size={14} class="animate-spin" /> {ui.generating}
									{:else}
										{ui.aiSummary}
									{/if}
								</button>
							{/if}
						</div>
					</div>

					<div
						class="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5 font-sans text-sm leading-relaxed font-medium text-foreground shadow-inner"
					>
						{#if doc.extractedData?.ai_summary}
							{doc.extractedData.ai_summary}
						{:else}
							<div
								class="flex items-center gap-3 font-sans text-xs text-muted-foreground/60 italic"
							>
								{ui.noAiSummary}
							</div>
						{/if}
					</div>
				</div>

				<!-- Discussion Section -->
				<div class="space-y-4 border-t border-border/40 pt-6">
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-extrabold tracking-tight text-foreground uppercase">
							{ui.discussion}
						</h3>
					</div>

					<div class="space-y-3">
						{#each (doc.extractedData as any)?.comments || [] as comment}
							<div class="rounded-xl border border-border/30 bg-muted/20 p-3">
								<div class="mb-2 flex items-center justify-between gap-4">
									<div class="flex items-center gap-2">
										<span class="text-xs font-bold text-foreground">{comment.author}</span>
										<span
											class="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
										>
											{comment.role === 'lanh_dao'
												? ui.leadershipRole
												: comment.role === 'chuyen_vien'
													? ui.officerRole
													: comment.role}
										</span>
									</div>
									<span class="flex items-center gap-2 text-[10px] text-muted-foreground">
										{formatDistanceToNow(new Date(comment.timestamp * 1000), {
											addSuffix: true,
											locale: getDateLocale($locale)
										})}
										<button
											onclick={() => (replyingTo = comment)}
											class="ml-1 flex items-center gap-1 font-bold text-primary hover:underline"
										>
											<Reply size={10} />
											{ui.reply}
										</button>
									</span>
								</div>

								{#if comment.replyTo}
									<div class="mb-2 ml-1 border-l-2 border-primary/30 pl-2">
										<p class="mb-0.5 text-[10px] font-medium text-muted-foreground">
											Trả lời <span class="font-bold text-foreground">{comment.replyTo.author}</span
											>:
										</p>
										<p class="line-clamp-1 text-xs text-muted-foreground/80 italic">
											{comment.replyTo.textSnippet}
										</p>
									</div>
								{/if}

								<p class="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
									{comment.text}
								</p>
							</div>
						{/each}

						{#if ((doc.extractedData as any)?.comments || []).length === 0}
							<div class="py-4 text-center text-xs text-muted-foreground italic">
								{ui.noComments}
							</div>
						{/if}
					</div>

					{#if replyingTo}
						<div
							class="mb-1 flex animate-in items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-2.5 duration-300 slide-in-from-bottom-2"
						>
							<div class="min-w-0 flex-1 pr-4">
								<p class="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-primary">
									<Reply size={10} />
									{ui.replyingTo}
									{replyingTo.author}
								</p>
								<p class="truncate text-xs text-muted-foreground italic">{replyingTo.text}</p>
							</div>
							<button
								onclick={() => (replyingTo = null)}
								class="p-1 text-muted-foreground transition-colors hover:text-destructive"
								title={ui.cancelReply}
							>
								<X size={14} />
							</button>
						</div>
					{/if}
					<form
						class="flex gap-2"
						onsubmit={(e) => {
							e.preventDefault();
							postComment();
						}}
					>
						<input
							type="text"
							bind:value={newCommentText}
							placeholder={ui.commentPlaceholder}
							class="flex-1 rounded-xl border bg-background px-3 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none"
						/>
						<button
							type="submit"
							disabled={isPostingComment || !newCommentText.trim()}
							class="h-10 rounded-xl bg-primary/10 px-4 text-sm font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
							>{ui.send}</button
						>
					</form>
				</div>

				<div class="h-px w-full bg-border/40"></div>

				<!-- Review Form -->
				<div class="space-y-6">
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-3">
							<div>
								<h3 class="text-sm font-extrabold tracking-tight text-foreground uppercase">
									{ui.reviewMinutes}
								</h3>
								<p class="text-xs leading-relaxed text-muted-foreground">{ui.reviewHint}</p>
							</div>
							<button
								onclick={generateAIReport}
								disabled={generatingReport}
								class="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
							>
								{#if generatingReport}
									<Loader2 size={14} class="animate-spin" /> {ui.drafting}
								{:else}
									<Brain size={14} /> {ui.aiDraft}
								{/if}
							</button>
						</div>
					</div>

					<!-- Form -->
					{#if doc.status === 'ASSIGNED'}
						<div class="space-y-5">
							<!-- Decision Select -->
							<div class="space-y-2">
								<label
									for="decision"
									class="text-[11px] font-black tracking-widest text-muted-foreground uppercase"
									>{ui.proposal}</label
								>
								<div class="grid grid-cols-2 gap-3">
									<label class="cursor-pointer">
										<input
											type="radio"
											name="decision"
											value="APPROVE"
											bind:group={decision}
											class="sr-only"
										/>
										<div
											class="flex items-center gap-3 rounded-xl border p-4 transition-all {decision ===
											'APPROVE'
												? 'border-primary bg-primary/10 ring-1 ring-primary/50'
												: 'border-border/60 hover:bg-muted/30'}"
										>
											<CheckCircle2
												size={18}
												class={decision === 'APPROVE' ? 'text-primary' : 'text-muted-foreground'}
											/>
											<span
												class="text-sm font-bold {decision === 'APPROVE'
													? 'text-primary'
													: 'text-foreground'}">{ui.recommendApprove}</span
											>
										</div>
									</label>
									<label class="cursor-pointer">
										<input
											type="radio"
											name="decision"
											value="REVISION_REQUESTED"
											bind:group={decision}
											class="sr-only"
										/>
										<div
											class="flex items-center gap-3 rounded-xl border p-4 transition-all {decision ===
											'REVISION_REQUESTED'
												? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50'
												: 'border-border/60 hover:bg-muted/30'}"
										>
											<AlertCircle
												size={18}
												class={decision === 'REVISION_REQUESTED'
													? 'text-amber-500'
													: 'text-muted-foreground'}
											/>
											<span
												class="text-sm font-bold {decision === 'REVISION_REQUESTED'
													? 'text-amber-500'
													: 'text-foreground'}">{ui.requestRevision}</span
											>
										</div>
									</label>
								</div>
							</div>

							<!-- Feedback Text -->
							<div class="space-y-2">
								<label
									for="feedback"
									class="text-[11px] font-black tracking-widest text-muted-foreground uppercase"
								>
									{ui.opinion}
								</label>
								<textarea
									id="feedback"
									bind:value={feedbackText}
									rows={10}
									placeholder={ui.opinionPlaceholder}
									class="w-full resize-y rounded-2xl border border-border/50 bg-muted/10 px-4 py-3 font-mono text-sm leading-relaxed
										shadow-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
								></textarea>
							</div>

							<!-- Submit Button -->
							<button
								onclick={submitReview}
								disabled={submitting || !feedbackText.trim()}
								class="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-lg shadow-black/5 transition-all
									{decision === 'APPROVE'
									? 'bg-primary text-primary-foreground hover:bg-primary/90'
									: 'bg-amber-500 text-black hover:bg-amber-400'}
									active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{#if submitting}
									<Loader2 size={18} class="animate-spin" /> {ui.forwarding}
								{:else}
									{ui.forwardForApproval}
								{/if}
							</button>
						</div>
					{:else}
						<div
							class="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 font-bold text-emerald-600 dark:text-emerald-400"
						>
							<CheckCircle2 size={24} />
							<div>
								{ui.successForwarded}
								<a
									href="/portal"
									class="mt-1 block text-xs font-semibold underline decoration-emerald-500/40 underline-offset-4 hover:decoration-emerald-500"
									>{ui.backHome}</a
								>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
