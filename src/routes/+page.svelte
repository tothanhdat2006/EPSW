<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		Upload,
		FileText,
		CheckCircle,
		AlertCircle,
		Copy,
		ArrowRight,
		ArrowLeft,
		Mail,
		Settings2,
		ShieldCheck,
		FileUp,
		CreditCard,
		X
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription,
		CardFooter
	} from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { currentMessages, locale } from '$lib/i18n';

	// ─── Types ────────────────────────────────────────────────────────────────

	type Priority = 'NORMAL' | 'URGENT' | 'FLASH';
	type DocumentType = 'CA_NHAN' | 'HO_KINH_DOANH' | 'DOANH_NGHIEP';

	interface SubmitResult {
		documentId: string;
		trackingCode: string;
		status: string;
		message: string;
	}

	const MAX_SIZE_MB = 50;

	// ─── State ────────────────────────────────────────────────────────────────

	let currentStep = $state(1);
	let files = $state<File[]>([]);
	let documentType = $state<DocumentType>('CA_NHAN');
	let dragOver = $state(false);
	let copied = $state(false);
	let isPending = $state(false);
	let isSuccess = $state(false);
	let isError = $state(false);
	let result = $state<SubmitResult | null>(null);
	let citizenEmail = $state('');
	let citizenCccd = $state('');
	let fileInputEl = $state<HTMLInputElement | null>(null);

	const ui = $derived(
		$locale === 'en'
			? {
					docTypeOptions: [
						{
							value: 'CA_NHAN' as DocumentType,
							label: 'Individual',
							description: 'Records for an individual or household',
							icon: '👤'
						},
						{
							value: 'HO_KINH_DOANH' as DocumentType,
							label: 'Household business',
							description: 'Records for a household business entity',
							icon: '🏪'
						},
						{
							value: 'DOANH_NGHIEP' as DocumentType,
							label: 'Enterprise',
							description: 'Company, organization, or legal entity',
							icon: '🏢'
						}
					],
					maxFilesAlert: 'A maximum of 10 files is allowed. The list was automatically limited.',
					submitFailed: 'Submit failed',
					publicHomeDescription: 'Submit records online. Upload PDF documents or scanned images.',
					selectedFiles: 'files selected',
					totalSize: 'total size',
					addFiles: 'Add files',
					clearAll: 'Clear all',
					dropFiles: 'Drag and drop files here',
					browseFiles: 'or click to browse from your computer',
					contactInfo: 'Contact information',
					contactHint: 'Receive automatic processing updates by email',
					citizenId: 'Citizen ID / National ID',
					citizenIdError: 'Citizen ID must contain at least 9 characters.',
					optionalEmail: 'Email address (optional)',
					citizenIdHelp:
						'The citizen ID is used for security and identity verification when tracking records. Please enter it accurately.',
					chooseDocType: 'Choose record type',
					chooseDocTypeHint: 'Identify the owner type so AI can process the record more accurately',
					serverBusy: 'The server is busy. Please try submitting again later.',
					back: 'Back',
					continue: 'Continue',
					submitting: 'Submitting...',
					submitNow: 'Submit now',
					aesSecurity: 'AES-256 security',
					oneLayerVerification: 'Single-layer verification'
				}
			: {
					docTypeOptions: [
						{
							value: 'CA_NHAN' as DocumentType,
							label: 'Cá nhân',
							description: 'Hồ sơ thuộc cá nhân, hộ gia đình',
							icon: '👤'
						},
						{
							value: 'HO_KINH_DOANH' as DocumentType,
							label: 'Hộ kinh doanh',
							description: 'Hộ sơ kinh doanh cá thể, hộ gia đình',
							icon: '🏪'
						},
						{
							value: 'DOANH_NGHIEP' as DocumentType,
							label: 'Doanh nghiệp',
							description: 'Công ty, tổ chức, pháp nhân',
							icon: '🏢'
						}
					],
					maxFilesAlert: 'Tối đa 10 tệp được cho phép. Hệ thống đã tự động giới hạn danh sách.',
					submitFailed: 'Submit failed',
					publicHomeDescription: 'Nộp hồ sơ trực tuyến. Tải lên tài liệu PDF hoặc hình ảnh scan.',
					selectedFiles: 'tệp được chọn',
					totalSize: 'Tổng dung lượng',
					addFiles: 'Thêm tệp',
					clearAll: 'Xóa tất cả',
					dropFiles: 'Kéo và thả tệp vào đây',
					browseFiles: 'hoặc bấm để duyệt từ máy tính',
					contactInfo: 'Thông tin liên lạc',
					contactHint: 'Nhận cập nhật tiến độ xử lý hồ sơ tự động qua Email',
					citizenId: 'Số CCCD / CMND',
					citizenIdError: 'Số CCCD phải có ít nhất 9 ký tự.',
					optionalEmail: 'Địa chỉ Email (Tùy chọn)',
					citizenIdHelp:
						'Số CCCD được dùng để bảo mật và xác thực khi tra cứu hồ sơ. Vui lòng nhập chính xác.',
					chooseDocType: 'Chọn loại hồ sơ',
					chooseDocTypeHint: 'Xác định đối tượng chủ hồ sơ để AI xử lý chính xác hơn',
					serverBusy: 'Máy chủ đang bận. Vui lòng thử nộp lại sau.',
					back: 'Quay lại',
					continue: 'Tiếp tục',
					submitting: 'Gửi hồ sơ...',
					submitNow: 'Gửi hồ sơ ngay',
					aesSecurity: 'Bảo mật AES-256',
					oneLayerVerification: 'Xác thực 1-lớp'
				}
	);

	// ─── Navigation ─────────────────────────────────────────────────────────────

	function nextStep() {
		if (currentStep === 1 && files.length === 0) return;
		if (currentStep === 2 && citizenCccd.trim().length < 9) return;
		if (currentStep < 3) currentStep++;
	}

	function prevStep() {
		if (currentStep > 1) currentStep--;
	}

	function appendFiles(newFiles: File[]) {
		const existingNames = new Set(files.map((f) => f.name));
		const toAdd = newFiles.filter((f) => !existingNames.has(f.name));
		const newArray = [...files, ...toAdd];
		if (newArray.length > 10) {
			alert(ui.maxFilesAlert);
			files = newArray.slice(0, 10);
		} else {
			files = newArray;
		}
	}

	function removeFile(name: string, e: Event) {
		e.stopPropagation();
		files = files.filter((f) => f.name !== name);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) {
			appendFiles(Array.from(e.dataTransfer.files));
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			appendFiles(Array.from(input.files));
		}
		// Reset input so selecting the same file again triggers change event
		input.value = '';
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (files.length === 0) return;
		isPending = true;
		isError = false;
		try {
			const formData = new FormData();
			for (const f of files) {
				formData.append('file', f);
			}
			formData.append('documentType', documentType);
			if (citizenEmail) {
				formData.append('citizenEmail', citizenEmail);
			}
			if (citizenCccd) {
				formData.append('citizenCccd', citizenCccd.trim());
			}
			const res = await fetch('/api/documents', { method: 'POST', body: formData });
			if (!res.ok) throw new Error(ui.submitFailed);
			result = await res.json();
			isSuccess = true;
		} catch {
			isError = true;
		} finally {
			isPending = false;
		}
	}

	async function copyTracking() {
		if (result?.trackingCode) {
			await navigator.clipboard.writeText(result.trackingCode);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

	function resetForm() {
		isSuccess = false;
		isError = false;
		result = null;
		files = [];
		documentType = 'CA_NHAN';
		currentStep = 1;
		citizenEmail = '';
		citizenCccd = '';
	}
</script>

<svelte:head>
	<title>{$currentMessages.publicHomeTitle}</title>
	<meta name="description" content={ui.publicHomeDescription} />
</svelte:head>

<div class="mx-auto flex min-h-[85vh] max-w-2xl flex-col justify-center px-4 py-8">
	{#if isSuccess && result}
		<!-- ── Success state ── -->
		<Card
			class="glass-card relative animate-in overflow-hidden border-primary/20 bg-background/40 text-center backdrop-blur-xl duration-500 fade-in slide-in-from-bottom-4"
		>
			<div
				class="absolute inset-x-0 top-0 h-1.5 animate-pulse bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600"
			></div>
			<CardHeader class="pt-12">
				<div
					class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5"
				>
					<CheckCircle size={48} />
				</div>
				<CardTitle class="text-3xl font-extrabold tracking-tight"
					>{$currentMessages.uploadSuccess}</CardTitle
				>
				<CardDescription class="mx-auto mt-3 max-w-sm text-base leading-relaxed">
					{$currentMessages.uploadSuccessHint}
				</CardDescription>
			</CardHeader>
			<CardContent class="px-8 pb-8">
				<div
					class="group relative mb-8 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-md transition-all hover:bg-emerald-500/10"
				>
					<div class="space-y-1.5 text-left">
						<p class="text-[10px] font-bold tracking-[0.2em] text-emerald-600/70 uppercase">
							{$currentMessages.trackingCodeLabel}
						</p>
						<p class="font-mono text-2xl font-black tracking-tight text-emerald-700">
							{result.trackingCode}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onclick={copyTracking}
						class="h-12 w-12 rounded-xl text-emerald-600 transition-all hover:bg-emerald-500/20"
						title={$currentMessages.copyTrackingCode}
					>
						{#if copied}
							<CheckCircle size={22} class="scale-in-90 animate-in" />
						{:else}
							<Copy size={22} />
						{/if}
					</Button>
				</div>

				<div
					class="flex items-start gap-3 rounded-xl bg-muted/30 p-4 text-left text-sm text-muted-foreground"
				>
					<ShieldCheck size={18} class="mt-0.5 shrink-0 text-primary" />
					<p>{$currentMessages.dataProtected}</p>
				</div>
			</CardContent>
			<CardFooter class="bg-muted/20 px-8 py-6">
				<Button
					onclick={resetForm}
					class="text-md h-14 w-full font-bold shadow-xl shadow-primary/10 transition-all hover:shadow-primary/20"
				>
					{$currentMessages.submitAnother}
				</Button>
			</CardFooter>
		</Card>
	{:else}
		<!-- ── Wizard Header ── -->
		<div class="mb-12 animate-in text-center duration-1000 fade-in slide-in-from-top-4">
			<div class="mb-4 flex items-center justify-center gap-3">
				<div class="h-[1px] w-12 bg-gradient-to-r from-transparent to-primary/50"></div>
				<span class="text-xs font-black tracking-[0.3em] text-primary/80 uppercase"
					>{$currentMessages.onlinePublicServicePortal}</span
				>
				<div class="h-[1px] w-12 bg-gradient-to-l from-transparent to-primary/50"></div>
			</div>
			<h1
				class="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl"
			>
				{$currentMessages.submitOnlineProfile}
			</h1>
		</div>

		<!-- ── Step Indicator ── -->
		<div class="relative mb-10 flex items-center justify-between px-2">
			<!-- Connectors -->
			<div
				class="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-muted-foreground/10 px-10"
			>
				<div
					class="cubic-out h-full bg-primary transition-all duration-500"
					style="width: {(currentStep - 1) * 50}%"
				></div>
			</div>

			{#each [{ step: 1, icon: FileUp, label: $currentMessages.filesStep }, { step: 2, icon: Mail, label: $currentMessages.contactStep }, { step: 3, icon: Settings2, label: $currentMessages.submitStep }] as item}
				<div class="group relative z-10 flex flex-col items-center gap-2.5">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-all duration-500
							{currentStep >= item.step
							? 'scale-110 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25'
							: 'border-muted-foreground/20 bg-background text-muted-foreground'}"
					>
						<item.icon size={20} />
					</div>
					<span
						class="text-[10px] font-black tracking-widest uppercase {currentStep >= item.step
							? 'text-primary'
							: 'text-muted-foreground/50'}"
					>
						{item.label}
					</span>
				</div>
			{/each}
		</div>

		<Card
			class="glass-card relative overflow-hidden border-primary/10 bg-background/50 shadow-2xl backdrop-blur-2xl"
		>
			<div
				class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30"
			></div>

			<form onsubmit={handleSubmit} class="relative flex min-h-[420px] flex-col">
				<CardContent class="flex-1 overflow-hidden pt-10 pb-6">
					{#if currentStep === 1}
						<!-- Step 1: Upload -->
						<div
							in:fly={{ x: 20, duration: 400, delay: 200, easing: cubicOut }}
							out:fly={{ x: -20, duration: 300, easing: cubicOut }}
							class="space-y-6"
						>
							<div class="mb-2 space-y-2 text-center">
								<h2 class="text-2xl font-bold tracking-tight">{$currentMessages.uploadFiles}</h2>
								<p class="text-sm text-muted-foreground">{$currentMessages.uploadFilesHint}</p>
							</div>

							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div
								role="button"
								tabindex="0"
								ondrop={handleDrop}
								ondragover={(e) => {
									e.preventDefault();
									dragOver = true;
								}}
								ondragleave={() => (dragOver = false)}
								onclick={() => fileInputEl?.click()}
								onkeydown={(e) => e.key === 'Enter' && fileInputEl?.click()}
								class="group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300
									{dragOver
									? 'scale-[0.99] border-primary bg-primary/10'
									: files.length > 0
										? 'border-emerald-500/40 bg-emerald-500/5'
										: 'border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5'}"
							>
								{#if files.length > 0}
									<div class="flex animate-in flex-col items-center duration-300 zoom-in-95">
										<div
											class="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-500 ring-4 ring-emerald-500/10"
										>
											<FileText size={32} />
										</div>
										<p class="max-w-xs truncate text-lg font-bold">
											{files.length}/10 {ui.selectedFiles}
										</p>
										<p class="mt-1 text-xs font-black tracking-wider text-emerald-600/70 uppercase">
											{(files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB {ui.totalSize}
										</p>

										<div
											class="scrollbar-thin mt-4 flex max-h-[140px] w-full max-w-sm flex-col gap-2 overflow-y-auto px-1 pr-2"
										>
											{#each files as file}
												<div
													class="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/40 p-2.5 transition-colors hover:bg-muted/60"
												>
													<div class="flex items-center gap-2 overflow-hidden">
														<FileText size={14} class="shrink-0 text-emerald-500" />
														<span class="truncate text-xs font-bold">{file.name}</span>
													</div>
													<button
														type="button"
														class="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
														onclick={(e) => removeFile(file.name, e)}
													>
														<X size={14} />
													</button>
												</div>
											{/each}
										</div>

										<div class="mt-6 flex gap-3">
											{#if files.length < 10}
												<Button
													variant="outline"
													size="sm"
													class="h-8 text-xs font-bold"
													onclick={(e) => {
														e.stopPropagation();
														fileInputEl?.click();
													}}
												>
													{ui.addFiles}
												</Button>
											{/if}
											<Button
												variant="ghost"
												size="sm"
												class="h-8 border border-destructive/20 text-xs font-bold transition-colors hover:border-destructive hover:text-destructive"
												onclick={(e) => {
													e.stopPropagation();
													files = [];
												}}
											>
												{ui.clearAll}
											</Button>
										</div>
									</div>
								{:else}
									<div
										class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary"
									>
										<Upload size={28} />
									</div>
									<p class="text-lg font-bold">{ui.dropFiles}</p>
									<p class="mt-1.5 text-sm text-muted-foreground">{ui.browseFiles}</p>
									<div class="mt-8 flex flex-wrap justify-center gap-2">
										{#each ['.PDF', '.JPG', '.PNG', '.TIFF'] as format}
											<span
												class="rounded-md border border-border/50 bg-muted/50 px-2 py-1 text-[10px] font-bold text-muted-foreground"
												>{format}</span
											>
										{/each}
									</div>
								{/if}
								<input
									bind:this={fileInputEl}
									type="file"
									multiple
									accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
									class="hidden"
									onchange={handleFileSelect}
								/>
							</div>
						</div>
					{:else if currentStep === 2}
						<!-- Step 2: Details -->
						<div
							in:fly={{ x: 20, duration: 400, delay: 200, easing: cubicOut }}
							out:fly={{ x: -20, duration: 300, easing: cubicOut }}
							class="space-y-8 py-4"
						>
							<div class="space-y-2 text-center">
								<h2 class="text-2xl font-bold tracking-tight">{ui.contactInfo}</h2>
								<p class="text-sm text-muted-foreground">{ui.contactHint}</p>
							</div>

							<div class="mx-auto max-w-sm space-y-4 pt-6">
								<!-- CCCD field (required) -->
								<div class="space-y-2">
									<Label
										for="citizen-cccd"
										class="ml-1 text-xs font-black tracking-widest text-muted-foreground uppercase"
									>
										{ui.citizenId} <span class="text-destructive">*</span>
									</Label>
									<div class="group relative">
										<CreditCard
											size={18}
											class="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
										/>
										<input
											id="citizen-cccd"
											type="text"
											maxlength="12"
											placeholder="012345678901"
											bind:value={citizenCccd}
											class="w-full rounded-2xl border border-muted-foreground/20 bg-muted/20 py-4 pr-4 pl-11 font-mono text-sm font-medium transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none
												{citizenCccd.length > 0 && citizenCccd.trim().length < 9
												? 'border-destructive/50 focus:ring-destructive/20'
												: ''}"
										/>
									</div>
									{#if citizenCccd.length > 0 && citizenCccd.trim().length < 9}
										<p class="ml-1 text-xs font-medium text-destructive">{ui.citizenIdError}</p>
									{/if}
								</div>

								<!-- Email field (optional) -->
								<div class="space-y-2">
									<Label
										for="citizen-email"
										class="ml-1 text-xs font-black tracking-widest text-muted-foreground uppercase"
										>{ui.optionalEmail}</Label
									>
									<div class="group relative">
										<Mail
											size={18}
											class="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
										/>
										<input
											id="citizen-email"
											type="email"
											placeholder="username@example.com"
											bind:value={citizenEmail}
											class="w-full rounded-2xl border border-muted-foreground/20 bg-muted/20 py-4 pr-4 pl-11 text-sm font-medium transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
										/>
									</div>
								</div>

								<div
									class="flex items-start gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4 text-primary/70 transition-all hover:bg-primary/10"
								>
									<AlertCircle size={16} class="mt-0.5 shrink-0" />
									<p class="text-xs leading-relaxed font-medium">{ui.citizenIdHelp}</p>
								</div>
							</div>
						</div>
					{:else}
						<!-- Step 3: Document Type -->
						<div
							in:fly={{ x: 20, duration: 400, delay: 200, easing: cubicOut }}
							out:fly={{ x: -20, duration: 300, easing: cubicOut }}
							class="space-y-8 py-2"
						>
							<div class="space-y-2 text-center">
								<h2 class="text-2xl font-bold tracking-tight">{ui.chooseDocType}</h2>
								<p class="text-sm text-muted-foreground">{ui.chooseDocTypeHint}</p>
							</div>

							<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
								{#each ui.docTypeOptions as opt}
									<label
										class="relative flex cursor-pointer flex-col items-center rounded-2xl border-2 p-6 text-center transition-all duration-300
											{documentType === opt.value
											? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
											: 'border-muted-foreground/10 bg-muted/10 hover:border-primary/30 hover:bg-muted/30'}"
									>
										<input
											type="radio"
											name="documentType"
											value={opt.value}
											bind:group={documentType}
											class="sr-only"
										/>
										<span class="mb-3 block text-3xl">{opt.icon}</span>
										<span
											class="text-sm font-bold {documentType === opt.value
												? 'text-primary'
												: 'text-foreground'}">{opt.label}</span
										>
										<span class="mt-1.5 text-[10px] leading-tight font-medium text-muted-foreground"
											>{opt.description}</span
										>
										{#if documentType === opt.value}
											<div class="absolute top-3 right-3 animate-in zoom-in-50">
												<CheckCircle size={16} class="text-primary" />
											</div>
										{/if}
									</label>
								{/each}
							</div>

							{#if isError}
								<div
									in:fade
									class="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"
								>
									<AlertCircle size={20} class="shrink-0" />
									<p class="text-xs font-bold tracking-wide uppercase">{ui.serverBusy}</p>
								</div>
							{/if}
						</div>
					{/if}
				</CardContent>

				<CardFooter
					class="flex items-center justify-between border-t border-border/50 bg-muted/10 px-8 py-8"
				>
					{#if currentStep > 1}
						<Button
							type="button"
							variant="ghost"
							onclick={prevStep}
							disabled={isPending}
							class="h-12 gap-2 rounded-xl px-6 font-bold hover:bg-background"
						>
							<ArrowLeft size={18} />
							{ui.back}
						</Button>
					{:else}
						<div></div>
					{/if}

					{#if currentStep < 3}
						<button
							type="button"
							onclick={nextStep}
							disabled={currentStep === 1
								? files.length === 0
								: currentStep === 2
									? citizenCccd.trim().length < 9
									: false}
							class="flex h-12 items-center gap-2 rounded-xl bg-primary px-8 font-bold text-primary-foreground
								shadow-lg shadow-primary/20 transition-all hover:bg-primary/90
								disabled:cursor-not-allowed disabled:opacity-40"
						>
							{ui.continue}
							<ArrowRight size={18} />
						</button>
					{:else}
						<Button
							type="submit"
							disabled={files.length === 0 || isPending}
							class="group relative h-12 min-w-[160px] overflow-hidden rounded-xl px-8 font-bold shadow-xl shadow-primary/25"
						>
							{#if isPending}
								<span class="flex items-center gap-2">
									<span
										class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
									></span>
									{ui.submitting}
								</span>
							{:else}
								{ui.submitNow}
								<ArrowRight size={18} class="ml-2 transition-transform group-hover:translate-x-1" />
							{/if}
						</Button>
					{/if}
				</CardFooter>
			</form>
		</Card>

		<div class="mt-12 flex animate-in justify-center gap-8 delay-500 duration-1000 fade-in">
			<div
				class="flex items-center gap-2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
			>
				<ShieldCheck size={16} />
				<span class="text-[10px] font-bold tracking-[0.2em] uppercase">{ui.aesSecurity}</span>
			</div>
			<div
				class="flex items-center gap-2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
			>
				<CheckCircle size={16} />
				<span class="text-[10px] font-bold tracking-[0.2em] uppercase"
					>{ui.oneLayerVerification}</span
				>
			</div>
		</div>
	{/if}
</div>
