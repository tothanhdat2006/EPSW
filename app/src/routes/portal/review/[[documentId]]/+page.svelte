<script lang="ts">
	import { page } from '$app/state';
	import {
		Shield,
		Brain,
		Calendar,
		User,
		Building,
		ExternalLink,
		FileText,
		ImageIcon,
		Save,
		Sparkles,
		MessageSquare,
		Send,
		Loader2,
		RotateCw,
		X
	} from 'lucide-svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { documentsApi, aiApi } from '$lib/api/client';
	import type { DocumentSummary } from '$lib/api/types';

	// ─── Props ────────────────────────────────────────────────────────────────

	// [[documentId]] — optional param from the URL
	const documentId = $derived(page.params.documentId ?? null);

	// ─── State ────────────────────────────────────────────────────────────────

	let document = $state<DocumentSummary | null>(null);
	let isLoading = $state(false);
	let editedData = $state<Record<string, string>>({});
	let showRedacted = $state(false);
	let showChat = $state(false);
	let chatMessage = $state('');
	let chatHistory = $state<{ role: string; content: string }[]>([]);
	let isChatLoading = $state(false);
	let isReAnalyzing = $state(false);
	let isSaving = $state(false);

	// ─── Data loading ─────────────────────────────────────────────────────────

	$effect(() => {
		if (!documentId) {
			document = null;
			return;
		}
		isLoading = true;
		editedData = {};
		documentsApi
			.get(documentId)
			.then((d) => (document = d))
			.catch(() => (document = null))
			.finally(() => (isLoading = false));
	});

	// ─── Derived ──────────────────────────────────────────────────────────────

	const extracted = $derived((document as any)?.extractedData ?? {});

	const fields = $derived([
		{ key: 'documentType', label: 'Loại hồ sơ', value: extracted['documentType'], icon: Shield },
		{ key: 'issuingAuthority', label: 'Cơ quan ban hành', value: extracted['issuingAuthority'], icon: Building },
		{ key: 'issueDate', label: 'Ngày ban hành', value: extracted['issueDate'], icon: Calendar },
		{ key: 'expiryDate', label: 'Ngày hết hạn', value: extracted['expiryDate'], icon: Calendar },
		{ key: 'subjectName', label: 'Tên đối tượng', value: extracted['subjectName'], icon: User },
		{ key: 'subjectId', label: 'Mã định danh', value: extracted['subjectId'], icon: User },
		{ key: 'purpose', label: 'Mục đích', value: extracted['purpose'], icon: Brain }
	]);

	function proxiedUrl(url?: string): string | undefined {
		if (!url) return undefined;
		if (url.includes('localhost:9000')) return url.split('localhost:9000')[1];
		return url;
	}

	const currentFileUrl = $derived(
		proxiedUrl(showRedacted ? document?.redactedFileUrl : document?.rawFileUrl)
	);

	// ─── Actions ──────────────────────────────────────────────────────────────

	async function reAnalyze() {
		if (!documentId || !document) return;
		isReAnalyzing = true;
		try {
			await aiApi.reAnalyze(documentId, document.trackingCode, (document as any)?.extractedData?.rawText ?? '');
			alert('Đã gửi yêu cầu tái phân tích AI!');
		} finally {
			isReAnalyzing = false;
		}
	}

	async function sendChat() {
		if (!chatMessage.trim() || !documentId) return;
		const msg = chatMessage;
		chatMessage = '';
		chatHistory = [...chatHistory, { role: 'user', content: msg }];
		isChatLoading = true;
		try {
			const res = await aiApi.chat(documentId, msg, chatHistory);
			chatHistory = [
				...chatHistory,
				{ role: 'assistant', content: res.error ? `Lỗi: ${res.error}` : (res.response ?? 'Không có phản hồi từ AI.') }
			];
		} catch {
			chatHistory = [
				...chatHistory,
				{ role: 'assistant', content: 'Lỗi: Không thể kết nối tới máy chủ AI. Vui lòng kiểm tra lại dịch vụ.' }
			];
		} finally {
			isChatLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Kiểm duyệt hồ sơ — DVC Portal</title>
</svelte:head>

{#if !documentId}
	<div class="flex h-full items-center justify-center p-8">
		<p class="text-gray-400">Chọn một hồ sơ từ Dashboard để xem chi tiết</p>
	</div>
{:else if isLoading}
	<div class="p-8 text-gray-400">Đang tải...</div>
{:else if !document}
	<div class="p-8 text-red-500">Không tìm thấy hồ sơ</div>
{:else}
	<div class="flex h-full flex-col bg-gray-50">
		<!-- Header -->
		<header class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4 shadow-sm">
			<div class="flex items-center gap-4">
				<div>
					<h1 class="flex items-center gap-2 text-xl font-bold text-gray-900">
						<Sparkles class="text-blue-500" size={20} /> Kiểm duyệt hồ sơ
					</h1>
					<p class="mt-0.5 font-mono text-xs text-blue-700">{document.trackingCode}</p>
				</div>
				<div class="mx-1 h-8 w-px bg-gray-200"></div>
				<div class="flex items-center gap-2">
					<PriorityBadge priority={document.priority} />
					<StatusBadge status={document.status} />
				</div>
			</div>

			<div class="flex items-center gap-3">
				{#if document.redactedFileUrl}
					<div class="mr-2 flex rounded-lg border border-gray-200 bg-gray-100 p-1">
						<button
							onclick={() => (showRedacted = false)}
							class="rounded-md px-3 py-1 text-xs font-medium transition-all
								{!showRedacted ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}"
						>
							Gốc
						</button>
						<button
							onclick={() => (showRedacted = true)}
							class="rounded-md px-3 py-1 text-xs font-medium transition-all
								{showRedacted ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}"
						>
							Đã che
						</button>
					</div>
				{/if}
				<button
					disabled={Object.keys(editedData).length === 0 || isSaving}
					class="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium
						text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
				>
					<Save size={16} /> Lưu chỉnh sửa
				</button>
			</div>
		</header>

		<div class="flex flex-1 overflow-hidden">
			<!-- Left: File viewer -->
			<div class="flex flex-1 flex-col overflow-hidden p-6">
				{#if !currentFileUrl}
					<div
						class="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-100 p-12 text-gray-400"
					>
						<FileText size={48} class="mb-4 opacity-20" />
						<p>Không có file đính kèm</p>
					</div>
				{:else}
					{@const isPdf = currentFileUrl.toLowerCase().endsWith('.pdf')}
					<div
						class="flex min-h-[600px] flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
					>
						<!-- File bar -->
						<div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
							<div class="flex items-center gap-2">
								{#if isPdf}
									<FileText size={16} class="text-red-500" />
								{:else}
									<ImageIcon size={16} class="text-blue-500" />
								{/if}
								<span class="text-sm font-semibold text-gray-700">
									{showRedacted ? 'Bản đã che PII' : 'Bản gốc'}
								</span>
							</div>
							<a
								href={currentFileUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-200"
								title="Mở trong tab mới"
							>
								<ExternalLink size={16} />
							</a>
						</div>
						<div class="flex flex-1 items-center justify-center overflow-auto bg-gray-800 p-4">
							{#if isPdf}
								<iframe src={currentFileUrl} title="Tài liệu hồ sơ" class="h-full w-full rounded border-none bg-white shadow-lg"></iframe>
							{:else}
								<img
									src={currentFileUrl}
									alt="Tài liệu hồ sơ"
									class="h-auto max-w-full rounded shadow-2xl transition-transform duration-300 hover:scale-105"
								/>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Right: Insights sidebar -->
			<aside class="w-[440px] space-y-6 overflow-y-auto border-l border-gray-200 bg-gray-50 p-6">
				<!-- AI panel -->
				<section class="space-y-3">
					<div class="flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
							<MessageSquare size={14} /> Nhận định từ AI (Qwen)
						</h2>
						<div class="flex gap-2">
							<button
								onclick={reAnalyze}
								disabled={isReAnalyzing}
								class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-blue-500"
								title="Tái phân tích hồ sơ"
							>
								<RotateCw size={14} class={isReAnalyzing ? 'animate-spin' : ''} />
							</button>
							<button
								onclick={() => (showChat = !showChat)}
								class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-blue-500
									{showChat ? 'bg-blue-50 text-blue-500 shadow-inner' : ''}"
								title="Chat với AI"
							>
								<MessageSquare size={14} />
							</button>
						</div>
					</div>

					<!-- AI summary card -->
					<div class="relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
						<div class="absolute top-0 right-0 p-1 opacity-10">
							<Brain size={40} class="text-blue-500" />
						</div>
						<div class="flex gap-3">
							<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
								<Brain size={16} class="text-white" />
							</div>
							<div class="space-y-2">
								<p class="text-sm font-medium leading-relaxed text-gray-700">
									Chào Admin! Tôi đã phân tích hồ sơ này. Đây là một bản <strong
										>{extracted['documentType'] || 'Hồ sơ chưa xác định'}</strong
									>.
								</p>
								<p class="text-sm italic text-gray-600">
									{extracted['summary']
										? `"${extracted['summary']}"`
										: 'Tôi đã tự động điền các trường thông tin trích xuất được bên dưới để bạn đối soát.'}
								</p>
								<div class="flex items-center gap-3 pt-2">
									<span
										class="rounded-full px-2 py-0.5 text-[10px] font-bold
											{(document.aiConfidence ?? 0) >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}"
									>
										Độ tin cậy: {(document.aiConfidence ?? 0).toFixed(1)}%
									</span>
									<span class="text-[10px] text-gray-400">Qwen-3.5-Plus</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Chat drawer -->
					{#if showChat}
						<div
							class="mt-4 flex h-[400px] flex-col overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-xl"
						>
							<div class="flex items-center justify-between bg-blue-600 p-3 text-white">
								<div class="flex items-center gap-2">
									<Sparkles size={14} />
									<span class="text-xs font-bold">Qwen Assistant</span>
								</div>
								<button
									onclick={() => (showChat = false)}
									class="rounded p-1 transition-colors hover:bg-blue-700"
								>
									<X size={14} />
								</button>
							</div>

							<div class="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4">
								{#if chatHistory.length === 0 && !isChatLoading}
									<div class="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-[13px] leading-relaxed text-blue-800 shadow-sm">
										Chào bạn! Tôi sẵn sàng giải đáp các thắc mắc về nội dung hồ sơ này. Bạn cần tôi hỗ trợ gì?
									</div>
								{/if}
								{#each chatHistory as chat}
									<div class="flex {chat.role === 'user' ? 'justify-end' : 'justify-start'}">
										<div
											class="max-w-[85%] rounded-2xl p-3 text-[13px] leading-relaxed shadow-sm
												{chat.role === 'user'
												? 'rounded-tr-none bg-blue-600 text-white'
												: chat.content.startsWith('Lỗi:')
													? 'rounded-tl-none border border-red-100 bg-red-50 text-red-700'
													: 'rounded-tl-none border border-gray-100 bg-white text-gray-700'}"
										>
											{chat.content}
										</div>
									</div>
								{/each}
								{#if isChatLoading}
									<div class="flex justify-start">
										<div class="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
											<Loader2 size={16} class="animate-spin text-blue-500" />
										</div>
									</div>
								{/if}
							</div>

							<div class="border-t border-gray-100 bg-white p-3">
								<form
									onsubmit={(e) => {
										e.preventDefault();
										sendChat();
									}}
									class="flex gap-2"
								>
									<input
										type="text"
										bind:value={chatMessage}
										placeholder="Hỏi AI về hồ sơ..."
										class="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500"
									/>
									<button
										type="submit"
										disabled={isChatLoading || !chatMessage.trim()}
										class="rounded-xl bg-blue-600 p-2 text-white shadow-md transition-all hover:bg-blue-700 active:scale-90 disabled:opacity-50"
									>
										<Send size={18} />
									</button>
								</form>
							</div>
						</div>
					{/if}
				</section>

				<!-- Extracted data form -->
				<section class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
					<h2 class="mb-5 border-b border-gray-100 pb-3 text-sm font-semibold text-gray-700">
						Dữ liệu trích xuất
					</h2>
					<div class="space-y-4">
						{#each fields as field}
							{@const isAutoFilled = field.value !== undefined && field.value !== null && field.value !== ''}
							<div class="group">
								<label
									for="field-{field.key}"
									class="mb-1.5 flex items-center justify-between gap-1.5 text-[11px] font-bold uppercase text-gray-400"
								>
									<span class="flex items-center gap-1.5">
										<field.icon size={12} class="transition-colors group-hover:text-blue-500" />
										{field.label}
									</span>
									{#if isAutoFilled}
										<span class="flex items-center gap-0.5 text-[9px] lowercase text-green-500 opacity-0 transition-opacity group-hover:opacity-100">
											<Sparkles size={8} /> AI auto-filled
										</span>
									{/if}
								</label>
								<div class="relative">
									<input
										id="field-{field.key}"
										type="text"
										value={editedData[field.key] ?? ((field.value as string) ?? '')}
										placeholder="..."
										oninput={(e) => {
											editedData = { ...editedData, [field.key]: (e.target as HTMLInputElement).value };
										}}
										class="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-500
											{isAutoFilled ? 'border-green-100 bg-gray-50' : 'border-gray-200 bg-gray-50'}"
									/>
									{#if isAutoFilled}
										<div class="absolute top-1/2 right-3 -translate-y-1/2 text-green-400 opacity-30">
											<Sparkles size={12} />
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- SLA & Security footer -->
				<div class="grid grid-cols-2 gap-4">
					<div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
						<p class="mb-1 text-[10px] font-bold uppercase text-gray-400">Bảo mật</p>
						<p class="text-xs font-semibold text-gray-800">{document.securityLevel}</p>
					</div>
					{#if document.slaDeadline}
						<div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
							<p class="mb-1 text-[10px] font-bold uppercase text-gray-400">Hạn SLA</p>
							<div class="flex items-center gap-1">
								<Calendar size={12} class="text-red-500" />
								<p class="text-xs font-semibold text-gray-800">
									{new Date(document.slaDeadline).toLocaleDateString('vi-VN')}
								</p>
							</div>
						</div>
					{/if}
				</div>
			</aside>
		</div>
	</div>
{/if}
