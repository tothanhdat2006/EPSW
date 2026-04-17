<script lang="ts">
	import { page } from '$app/state';
	import {
		Shield, Brain, Calendar, User, Building, ExternalLink, FileText,
		ImageIcon, Save, Sparkles, MessageSquare, Send, Loader2, RotateCw, X
	} from 'lucide-svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { documentsApi, aiApi } from '$lib/api/client';
	import type { DocumentSummary } from '$lib/api/types';

	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';

	// ─── Props ────────────────────────────────────────────────────────────────

	const documentId = $derived(page.params.id ?? null);

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
	let selectedFileIndex = $state(0);

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

	const fileUrls = $derived.by(() => {
		if (showRedacted && document?.redactedFileUrl) return [proxiedUrl(document.redactedFileUrl)!];
		if (document?.rawFileUrls) return document.rawFileUrls.map(u => proxiedUrl(u)!).filter(Boolean);
		return [];
	});

	const currentFileUrl = $derived(fileUrls[selectedFileIndex] || fileUrls[0]);

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
	<title>Inspector — DVC AI Enterprise</title>
</svelte:head>

{#if !documentId}
	<div class="flex h-full items-center justify-center p-8">
		<p class="text-muted-foreground font-medium">Bấm vào một hồ sơ từ Mission Control để xem chi tiết</p>
	</div>
{:else if isLoading}
	<div class="flex h-full items-center justify-center p-8 flex-col gap-4">
		<Loader2 size={32} class="animate-spin text-primary" />
		<p class="text-primary font-medium tracking-wide">Đang nạp dữ liệu không gian 3 chiều...</p>
	</div>
{:else if !document}
	<div class="flex h-full items-center justify-center p-8">
		<p class="text-destructive font-bold text-lg">Cảnh báo: Không tìm thấy hồ sơ hệ thống</p>
	</div>
{:else}
	<div class="flex h-full flex-col bg-background/50">
		<!-- Header -->
		<header class="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-muted/30 backdrop-blur-3xl px-8 py-4 shadow-xl">
			<div class="flex items-center gap-5">
				<div>
					<h1 class="flex items-center gap-2 text-xl font-extrabold tracking-tight text-foreground">
						<Sparkles class="text-primary" size={20} /> AI Inspector
					</h1>
					<p class="mt-0.5 font-mono text-xs font-semibold text-primary">{document.trackingCode}</p>
				</div>
				<div class="h-8 w-px bg-border"></div>
				<div class="flex items-center gap-3">
					<PriorityBadge priority={document.priority} />
					<StatusBadge status={document.status} />
				</div>
			</div>

			<div class="flex items-center gap-4">
				{#if document.redactedFileUrl}
					<div class="flex rounded-lg border border-border/50 bg-background/50 p-1 backdrop-blur-md">
						<Button
							variant={!showRedacted ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => (showRedacted = false)}
							class={!showRedacted ? 'bg-background shadow-md' : 'hover:bg-transparent text-muted-foreground hover:text-foreground'}
						>
							Bản Root
						</Button>
						<Button
							variant={showRedacted ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => (showRedacted = true)}
							class={showRedacted ? 'bg-background shadow-md' : 'hover:bg-transparent text-muted-foreground hover:text-foreground'}
						>
							Bản Masked-PII
						</Button>
					</div>
				{/if}
				<Button
					disabled={Object.keys(editedData).length === 0 || isSaving}
					size="sm"
					class="gap-2 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20"
				>
					<Save size={16} /> Đồng bộ Data
				</Button>
			</div>
		</header>

		<div class="flex flex-1 overflow-hidden p-6 gap-6">
			<!-- Left: File viewer -->
			<Card class="flex flex-1 flex-col overflow-hidden glass-card shadow-2xl relative group">
				{#if fileUrls.length === 0}
					<div
						class="flex h-full flex-col items-center justify-center bg-muted/10 p-12 text-muted-foreground"
					>
						<FileText size={48} class="mb-4 opacity-20" />
						<p>Không có Data Object Mapping</p>
					</div>
				{:else}
					{@const isPdf = currentFileUrl?.toLowerCase().endsWith('.pdf')}
					<!-- File bar -->
					<div class="flex items-center justify-between border-b border-border/40 bg-muted/40 px-4 py-3 backdrop-blur-md z-10 w-full overflow-x-auto gap-4">
						<div class="flex items-center gap-3">
							<div class="p-1.5 rounded-md bg-background border border-border/50">
								{#if isPdf}
									<FileText size={16} class="text-rose-500" />
								{:else}
									<ImageIcon size={16} class="text-blue-500" />
								{/if}
							</div>
							<span class="text-sm font-bold tracking-wide uppercase text-foreground whitespace-nowrap">
								{showRedacted ? 'Visual Masked' : 'Visual Origin'}
							</span>
						</div>

						{#if fileUrls.length > 1}
							<div class="flex bg-muted/30 p-1 rounded-lg shrink-0 gap-1">
								{#each fileUrls as url, idx}
									<button 
										class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {selectedFileIndex === idx ? 'bg-background shadow-sm text-primary ring-1 ring-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
										onclick={() => selectedFileIndex = idx}
									>
										Tệp {idx + 1}
									</button>
								{/each}
							</div>
						{/if}
						<Button
							href={currentFileUrl}
							target="_blank"
							rel="noopener noreferrer"
							variant="ghost"
							size="icon"
							class="text-muted-foreground hover:bg-primary/20 hover:text-primary rounded-lg transition-colors"
						>
							<ExternalLink size={18} />
						</Button>
					</div>
					<div class="flex flex-1 relative items-center justify-center overflow-auto bg-muted/10 p-4">
						<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none"></div>
						{#if isPdf}
							<iframe src={currentFileUrl} title="Tài liệu hồ sơ" class="h-full w-full rounded-lg border border-border/50 bg-background shadow-2xl z-10 relative"></iframe>
						{:else}
							<img
								src={currentFileUrl}
								alt="Tài liệu hồ sơ"
								class="h-auto max-w-full rounded-lg shadow-2xl border border-border/50 relative z-10 ring-4 ring-background transition-transform duration-500 group-hover:scale-[1.01]"
							/>
						{/if}
					</div>
				{/if}
			</Card>

			<!-- Right: Insights sidebar -->
			<aside class="w-[480px] shrink-0 space-y-6 overflow-y-auto">
				<!-- AI panel -->
				<section class="space-y-4">
					<div class="flex items-center justify-between px-1">
						<h2 class="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary">
							<MessageSquare size={14} /> Cognitive AI (Qwen)
						</h2>
						<div class="flex gap-2">
							<Button
								variant="ghost"
								size="icon"
								onclick={reAnalyze}
								disabled={isReAnalyzing}
								class="h-8 w-8 hover:bg-primary/20 text-muted-foreground hover:text-primary"
								title="Force Re-compute OCR"
							>
								<RotateCw size={14} class={isReAnalyzing ? 'animate-spin text-primary' : ''} />
							</Button>
							<Button
								variant={showChat ? 'secondary' : 'ghost'}
								size="icon"
								onclick={() => (showChat = !showChat)}
								class="h-8 w-8 {showChat ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/20 hover:text-primary'}"
								title="Toggle Neural Chat"
							>
								<MessageSquare size={14} />
							</Button>
						</div>
					</div>

					<!-- AI summary card -->
					<Card class="glass-card shadow-lg relative overflow-hidden group">
						<div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
						<div class="absolute -right-4 -top-4 opacity-10 transition-transform group-hover:rotate-12 group-hover:scale-125 duration-700 pointer-events-none">
							<Brain size={100} class="text-primary" />
						</div>
						<CardContent class="p-5">
							<div class="flex gap-4 relative z-10">
								<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 shadow-inner">
									<Brain size={20} class="text-primary animate-pulse" />
								</div>
								<div class="space-y-2">
									<p class="text-sm font-semibold leading-relaxed text-foreground">
										Nhận diện thành công: <span class="text-primary tracking-wide">{(extracted['documentType'] || 'UNKNOWN').toUpperCase()}</span>
									</p>
									<p class="text-[13px] italic text-muted-foreground/90 font-medium">
										{extracted['summary']
											? `"${extracted['summary']}"`
											: 'Data mapping đã hoàn tất. Vui lòng đối soát các tham số trích xuất bên dưới trước khi đồng bộ.'}
									</p>
									<div class="flex items-center gap-3 pt-3">
										<div class="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-bold border
												{(document.aiConfidence ?? 0) >= 70 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-red-500/30 bg-red-500/10 text-red-500'}"
										>
											<Sparkles size={10} /> Confidence: {(document.aiConfidence ?? 0).toFixed(1)}%
										</div>
										<span class="text-[9px] font-mono font-semibold tracking-wider text-muted-foreground uppercase opacity-80 border-b border-muted-foreground/30 border-dashed pb-px">Qwen-3.5-MAX</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<!-- Chat drawer -->
					{#if showChat}
						<Card class="glass-card shadow-2xl overflow-hidden mt-4 animate-in fade-in slide-in-from-top-4 duration-300 border-primary/30">
							<div class="flex items-center justify-between bg-primary/10 border-b border-primary/20 backdrop-blur-md p-3">
								<div class="flex items-center gap-2 text-primary">
									<Sparkles size={16} />
									<span class="text-xs font-bold tracking-widest uppercase">Qwen Neural Link</span>
								</div>
								<Button
									variant="ghost" size="icon"
									onclick={() => (showChat = false)}
									class="h-6 w-6 text-primary hover:bg-primary/20 hover:text-primary rounded-full transition-colors"
								>
									<X size={14} />
								</Button>
							</div>

							<ScrollArea class="h-[280px] bg-background/40">
								<div class="p-4 space-y-4">
									{#if chatHistory.length === 0 && !isChatLoading}
										<div class="rounded-xl border border-primary/20 bg-primary/5 p-4 text-[13px] font-medium leading-relaxed text-foreground shadow-sm max-w-[90%]">
											Kênh kết nối bảo mật đã thiết lập. Bạn cần truy vấn thông tin gì từ hồ sơ này?
										</div>
									{/if}
									{#each chatHistory as chat}
										<div class="flex {chat.role === 'user' ? 'justify-end' : 'justify-start'}">
											<div
												class="max-w-[85%] rounded-2xl p-3.5 text-[13px] font-medium leading-relaxed shadow-md
													{chat.role === 'user'
													? 'rounded-tr-none bg-primary text-primary-foreground'
													: chat.content.startsWith('Lỗi:')
														? 'rounded-tl-none border border-destructive/30 bg-destructive/10 text-destructive'
														: 'rounded-tl-none border border-border/50 bg-muted/50 text-foreground backdrop-blur-sm'}"
											>
												{chat.content}
											</div>
										</div>
									{/each}
									{#if isChatLoading}
										<div class="flex justify-start">
											<div class="rounded-2xl rounded-tl-none border border-border/30 bg-muted/30 p-3.5 shadow-sm backdrop-blur-sm">
												<Loader2 size={16} class="animate-spin text-primary" />
											</div>
										</div>
									{/if}
								</div>
							</ScrollArea>

							<div class="border-t border-primary/20 bg-muted/20 p-3 backdrop-blur-md">
								<form
									onsubmit={(e) => {
										e.preventDefault();
										sendChat();
									}}
									class="flex gap-2 items-center"
								>
									<Input
										type="text"
										bind:value={chatMessage}
										placeholder="Nhập truy vấn..."
										class="flex-1 rounded-xl bg-background border-border focus-visible:ring-primary shadow-inner"
									/>
									<Button
										type="submit"
										disabled={isChatLoading || !chatMessage.trim()}
										size="icon"
										class="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all disabled:opacity-50 shrink-0"
									>
										<Send size={16} />
									</Button>
								</form>
							</div>
						</Card>
					{/if}
				</section>

				<!-- Extracted data form -->
				<Card class="glass-card shadow-lg">
					<CardHeader class="pb-4 border-b border-border/40">
						<CardTitle class="text-[13px] font-extrabold uppercase tracking-[0.1em] text-foreground flex items-center gap-2">
							Dữ liệu định tuyến <Sparkles size={14} class="text-primary"/>
						</CardTitle>
					</CardHeader>
					<CardContent class="p-5 space-y-5">
						{#each fields as field}
							{@const isAutoFilled = field.value !== undefined && field.value !== null && field.value !== ''}
							<div class="group">
								<Label
									for="field-{field.key}"
									class="mb-2 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground"
								>
									<span class="flex items-center gap-1.5 truncate">
										<field.icon size={12} class="transition-colors group-hover:text-primary" />
										{field.label}
									</span>
									{#if isAutoFilled}
										<span class="flex items-center gap-0.5 text-[8px] font-mono text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100 bg-emerald-500/10 px-1.5 py-0.5 rounded">
											<Sparkles size={8} /> SYNCHRONIZED
										</span>
									{/if}
								</Label>
								<div class="relative">
									<Input
										id="field-{field.key}"
										type="text"
										value={editedData[field.key] ?? ((field.value as string) ?? '')}
										placeholder="Empty parameter"
										oninput={(e) => {
											editedData = { ...editedData, [field.key]: (e.target as HTMLInputElement).value };
										}}
										class="w-full h-11 text-sm font-medium {isAutoFilled ? 'bg-primary/5 border-primary/20 focus-visible:ring-primary' : 'bg-muted/40 focus-visible:ring-primary'} transition-all"
									/>
									{#if isAutoFilled}
										<div class="absolute top-1/2 right-3 -translate-y-1/2 text-primary/40">
											<Sparkles size={14} />
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</CardContent>
				</Card>

				<!-- SLA & Security footer -->
				<div class="grid grid-cols-2 gap-4">
					<Card class="glass-card shadow-md">
						<CardContent class="p-4">
							<p class="mb-1 text-[9px] font-bold tracking-[0.2em] uppercase text-muted-foreground/80">Security Protocol</p>
							<p class="text-sm font-extrabold tracking-wide text-foreground">{document.securityLevel}</p>
						</CardContent>
					</Card>
					{#if document.slaDeadline}
						<Card class="glass-card shadow-md relative overflow-hidden">
							<div class="absolute inset-x-0 bottom-0 h-0.5 bg-destructive"></div>
							<CardContent class="p-4">
								<p class="mb-1 text-[9px] font-bold tracking-[0.2em] uppercase text-muted-foreground/80">Deadline SLA</p>
								<div class="flex items-center gap-1.5">
									<Calendar size={14} class="text-destructive mb-px" />
									<p class="text-sm font-extrabold tracking-wide text-foreground">
										{new Date(document.slaDeadline).toLocaleDateString('vi-VN')}
									</p>
								</div>
							</CardContent>
						</Card>
					{/if}
				</div>
			</aside>
		</div>
	</div>
{/if}
