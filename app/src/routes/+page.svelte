<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { 
		Upload, FileText, CheckCircle, AlertCircle, Copy, 
		ArrowRight, ArrowLeft, Mail, Settings2, ShieldCheck,
		FileUp
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';

	// ─── Types ────────────────────────────────────────────────────────────────

	type Priority = 'NORMAL' | 'URGENT' | 'FLASH';

	interface SubmitResult {
		documentId: string;
		trackingCode: string;
		status: string;
		message: string;
	}

	const PRIORITY_OPTIONS: { value: Priority; label: string; description: string }[] = [
		{ value: 'NORMAL', label: 'Thường', description: 'Xử lý trong 48 giờ' },
		{ value: 'URGENT', label: 'Khẩn', description: 'Xử lý trong 2 giờ' },
		{ value: 'FLASH', label: 'Hỏa tốc', description: 'Xử lý ngay lập tức' }
	];

	const MAX_SIZE_MB = 50;

	// ─── State ────────────────────────────────────────────────────────────────

	let currentStep = $state(1);
	let file = $state<File | null>(null);
	let priority = $state<Priority>('NORMAL');
	let dragOver = $state(false);
	let copied = $state(false);
	let isPending = $state(false);
	let isSuccess = $state(false);
	let isError = $state(false);
	let result = $state<SubmitResult | null>(null);
	let citizenEmail = $state('');
	let fileInputEl = $state<HTMLInputElement | null>(null);

	// ─── Navigation ─────────────────────────────────────────────────────────────

	function nextStep() {
		if (currentStep === 1 && !file) return;
		if (currentStep < 3) currentStep++;
	}

	function prevStep() {
		if (currentStep > 1) currentStep--;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const droppedFile = e.dataTransfer?.files[0];
		if (droppedFile) file = droppedFile;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!file) return;
		isPending = true;
		isError = false;
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('priority', priority);
			if (citizenEmail) {
				formData.append('citizenEmail', citizenEmail);
			}
			const res = await fetch('/api/documents', { method: 'POST', body: formData });
			if (!res.ok) throw new Error('Submit failed');
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
		file = null;
		priority = 'NORMAL';
		currentStep = 1;
		citizenEmail = '';
	}
</script>

<svelte:head>
	<title>Nộp hồ sơ — Dịch vụ Công</title>
	<meta name="description" content="Nộp hồ sơ trực tuyến. Tải lên tài liệu PDF hoặc hình ảnh scan." />
</svelte:head>

<div class="mx-auto flex min-h-[85vh] max-w-2xl flex-col justify-center px-4 py-8">
	{#if isSuccess && result}
		<!-- ── Success state ── -->
		<Card class="glass-card text-center animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden relative border-primary/20 bg-background/40 backdrop-blur-xl">
			<div class="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600 animate-pulse"></div>
			<CardHeader class="pt-12">
				<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5">
					<CheckCircle size={48} />
				</div>
				<CardTitle class="text-3xl font-extrabold tracking-tight">Nộp hồ sơ thành công</CardTitle>
				<CardDescription class="text-base mt-3 max-w-sm mx-auto leading-relaxed">
					Hệ thống AI đang bắt đầu phân tích tập tin của bạn. <br/> Vui lòng lưu lại mã theo dõi bên dưới.
				</CardDescription>
			</CardHeader>
			<CardContent class="px-8 pb-8">
				<div
					class="group relative mb-8 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-md transition-all hover:bg-emerald-500/10"
				>
					<div class="text-left space-y-1.5">
						<p class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600/70">Mã định danh hồ sơ</p>
						<p class="font-mono text-2xl font-black text-emerald-700 tracking-tight">{result.trackingCode}</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onclick={copyTracking}
						class="h-12 w-12 rounded-xl transition-all hover:bg-emerald-500/20 text-emerald-600"
						title="Sao chép mã"
					>
						{#if copied}
							<CheckCircle size={22} class="animate-in scale-in-90" />
						{:else}
							<Copy size={22} />
						{/if}
					</Button>
				</div>
				
				<div class="text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl flex items-start gap-3 text-left">
					<ShieldCheck size={18} class="mt-0.5 text-primary shrink-0" />
					<p>Thông tin của bạn được bảo mật và mã hóa theo tiêu chuẩn an ninh quốc gia.</p>
				</div>
			</CardContent>
			<CardFooter class="bg-muted/20 px-8 py-6">
				<Button
					onclick={resetForm}
					class="w-full h-14 text-md font-bold shadow-xl shadow-primary/10 transition-all hover:shadow-primary/20"
				>
					Nộp thêm hồ sơ mới
				</Button>
			</CardFooter>
		</Card>
	{:else}
		<!-- ── Wizard Header ── -->
		<div class="mb-12 text-center animate-in fade-in duration-1000 slide-in-from-top-4">
			<div class="flex items-center justify-center gap-3 mb-4">
				<div class="h-[1px] w-12 bg-gradient-to-r from-transparent to-primary/50"></div>
				<span class="text-xs font-black uppercase tracking-[0.3em] text-primary/80">Cổng Dịch Vụ Công Trực Tuyến</span>
				<div class="h-[1px] w-12 bg-gradient-to-l from-transparent to-primary/50"></div>
			</div>
			<h1 class="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl">
				Nộp Hồ Sơ AI
			</h1>
		</div>

		<!-- ── Step Indicator ── -->
		<div class="mb-10 flex items-center justify-between px-2 relative">
			<!-- Connectors -->
			<div class="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-muted-foreground/10 px-10">
				<div 
					class="h-full bg-primary transition-all duration-500 cubic-out" 
					style="width: {(currentStep - 1) * 50}%"
				></div>
			</div>
			
			{#each [
				{ step: 1, icon: FileUp, label: 'Tệp tin' },
				{ step: 2, icon: Mail, label: 'Liên lạc' },
				{ step: 3, icon: Settings2, label: 'Gửi hồ sơ' }
			] as item}
				<div class="flex flex-col items-center gap-2.5 relative z-10 group">
					<div 
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-all duration-500
							{currentStep >= item.step 
								? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110' 
								: 'border-muted-foreground/20 bg-background text-muted-foreground'}"
					>
						<item.icon size={20} weight={currentStep >= item.step ? 'bold' : 'regular'} />
					</div>
					<span class="text-[10px] font-black uppercase tracking-widest {currentStep >= item.step ? 'text-primary' : 'text-muted-foreground/50'}">
						{item.label}
					</span>
				</div>
			{/each}
		</div>

		<Card class="glass-card overflow-hidden border-primary/10 bg-background/50 backdrop-blur-2xl shadow-2xl relative">
			<div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30"></div>
			
			<form onsubmit={handleSubmit} class="relative min-h-[420px] flex flex-col">
				<CardContent class="flex-1 pt-10 pb-6 overflow-hidden">
					{#if currentStep === 1}
						<!-- Step 1: Upload -->
						<div in:fly={{ x: 20, duration: 400, delay: 200, easing: cubicOut }} out:fly={{ x: -20, duration: 300, easing: cubicOut }} class="space-y-6">
							<div class="space-y-2 mb-2 text-center">
								<h2 class="text-2xl font-bold tracking-tight">Tải lên tài liệu</h2>
								<p class="text-sm text-muted-foreground">Vui lòng cung cấp hồ sơ bản scan hoặc ảnh chụp rõ nét</p>
							</div>
							
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div
								role="button"
								tabindex="0"
								ondrop={handleDrop}
								ondragover={(e) => { e.preventDefault(); dragOver = true; }}
								ondragleave={() => (dragOver = false)}
								onclick={() => fileInputEl?.click()}
								onkeydown={(e) => e.key === 'Enter' && fileInputEl?.click()}
								class="group relative flex flex-col items-center justify-center cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300
									{dragOver ? 'border-primary bg-primary/10 scale-[0.99]' : file ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5'}"
							>
								{#if file}
									<div class="flex flex-col items-center animate-in zoom-in-95 duration-300">
										<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-500 ring-4 ring-emerald-500/10">
											<FileText size={40} />
										</div>
										<p class="font-bold text-lg truncate max-w-xs">{file.name}</p>
										<p class="mt-1 text-xs font-black uppercase tracking-wider text-emerald-600/70">{(file.size / (1024 * 1024)).toFixed(2)} MB • Sẵn sàng</p>
										<Button variant="ghost" size="sm" class="mt-6 h-8 text-xs font-bold hover:text-destructive transition-colors" onclick={(e) => { e.stopPropagation(); file = null; }}>
											Thay đổi tệp tin
										</Button>
									</div>
								{:else}
									<div class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 group-hover:scale-110">
										<Upload size={28} />
									</div>
									<p class="text-lg font-bold">Kéo và thả tệp vào đây</p>
									<p class="mt-1.5 text-sm text-muted-foreground">hoặc bấm để duyệt từ máy tính</p>
									<div class="mt-8 flex flex-wrap justify-center gap-2">
										{#each ['.PDF', '.JPG', '.PNG', '.TIFF'] as format}
											<span class="px-2 py-1 rounded-md bg-muted/50 text-[10px] font-bold text-muted-foreground border border-border/50">{format}</span>
										{/each}
									</div>
								{/if}
								<input bind:this={fileInputEl} type="file" accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif" class="hidden" onchange={(e) => (file = (e.target as HTMLInputElement).files?.[0] ?? null)} />
							</div>
						</div>
					{:else if currentStep === 2}
						<!-- Step 2: Details -->
						<div in:fly={{ x: 20, duration: 400, delay: 200, easing: cubicOut }} out:fly={{ x: -20, duration: 300, easing: cubicOut }} class="space-y-8 py-4">
							<div class="space-y-2 text-center">
								<h2 class="text-2xl font-bold tracking-tight">Thông tin liên lạc</h2>
								<p class="text-sm text-muted-foreground">Nhận cập nhật tiến độ xử lý hồ sơ tự động qua Email</p>
							</div>

							<div class="space-y-4 max-w-sm mx-auto pt-6">
								<Label for="citizen-email" class="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Địa chỉ Email (Tùy chọn)</Label>
								<div class="relative group">
									<Mail size={18} class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
									<input
										id="citizen-email"
										type="email"
										placeholder="username@example.com"
										bind:value={citizenEmail}
										class="w-full rounded-2xl border border-muted-foreground/20 bg-muted/20 pl-11 pr-4 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all"
									/>
								</div>
								<div class="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 text-primary/70 border border-primary/10 transition-all hover:bg-primary/10">
									<AlertCircle size={16} class="mt-0.5 shrink-0" />
									<p class="text-xs leading-relaxed font-medium">Chúng tôi sẽ gửi kết quả trích xuất AI và mã theo dõi hồ sơ ngay khi bạn nộp thành công.</p>
								</div>
							</div>
						</div>
					{:else}
						<!-- Step 3: Priority -->
						<div in:fly={{ x: 20, duration: 400, delay: 200, easing: cubicOut }} out:fly={{ x: -20, duration: 300, easing: cubicOut }} class="space-y-8 py-2">
							<div class="space-y-2 text-center">
								<h2 class="text-2xl font-bold tracking-tight">Cấu hình hoàn tất</h2>
								<p class="text-sm text-muted-foreground">Chọn mức độ xử lý và tiến hành gửi hồ sơ cho AI</p>
							</div>

							<div class="space-y-4">
								<Label class="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Tùy chọn xử lý</Label>
								<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
									{#each PRIORITY_OPTIONS as opt}
										<label
											class="relative flex cursor-pointer flex-col p-5 rounded-2xl border-2 transition-all duration-300
												{priority === opt.value
												? 'border-primary bg-primary/5 shadow-inner'
												: 'border-muted-foreground/10 bg-muted/10 hover:border-primary/30 hover:bg-muted/30'}"
										>
											<input type="radio" name="priority" value={opt.value} bind:group={priority} class="sr-only" />
											<span class="text-sm font-bold {priority === opt.value ? 'text-primary' : 'text-foreground'}">{opt.label}</span>
											<span class="mt-1 text-[10px] font-medium text-muted-foreground leading-tight">{opt.description}</span>
											
											{#if priority === opt.value}
												<div class="absolute top-4 right-4 animate-in zoom-in-50">
													<CheckCircle size={16} class="text-primary" />
												</div>
											{/if}
										</label>
									{/each}
								</div>
							</div>

							{#if isError}
								<div in:fade class="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
									<AlertCircle size={20} class="shrink-0" />
									<p class="text-xs font-bold uppercase tracking-wide">Máy chủ đang bận. Vui lòng thử nộp lại sau.</p>
								</div>
							{/if}
						</div>
					{/if}
				</CardContent>

				<CardFooter class="flex items-center justify-between px-8 py-8 bg-muted/10 border-t border-border/50">
					{#if currentStep > 1}
						<Button type="button" variant="ghost" onclick={prevStep} disabled={isPending} class="h-12 px-6 font-bold gap-2 hover:bg-background rounded-xl">
							<ArrowLeft size={18} />
							Quay lại
						</Button>
					{:else}
						<div></div>
					{/if}

					{#if currentStep < 3}
						<Button type="button" onclick={nextStep} disabled={!file} class="h-12 px-8 font-bold gap-2 shadow-lg shadow-primary/20 rounded-xl">
							Tiếp tục
							<ArrowRight size={18} />
						</Button>
					{:else}
						<Button
							type="submit"
							disabled={!file || isPending}
							class="h-12 px-8 min-w-[160px] font-bold shadow-xl shadow-primary/25 rounded-xl group relative overflow-hidden"
						>
							{#if isPending}
								<span class="flex items-center gap-2">
									<span class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"></span>
									Gửi hồ sơ...
								</span>
							{:else}
								Gửi hồ sơ ngay
								<ArrowRight size={18} class="ml-2 transition-transform group-hover:translate-x-1" />
							{/if}
						</Button>
					{/if}
				</CardFooter>
			</form>
		</Card>

		<div class="mt-12 flex justify-center gap-8 animate-in fade-in duration-1000 delay-500">
			<div class="flex items-center gap-2 text-muted-foreground/60 transition-colors hover:text-muted-foreground">
				<ShieldCheck size={16} />
				<span class="text-[10px] font-bold uppercase tracking-[0.2em]">Bảo mật AES-256</span>
			</div>
			<div class="flex items-center gap-2 text-muted-foreground/60 transition-colors hover:text-muted-foreground">
				<CheckCircle size={16} />
				<span class="text-[10px] font-bold uppercase tracking-[0.2em]">Xác thực 1-lớp</span>
			</div>
		</div>
	{/if}
</div>

