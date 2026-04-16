<script lang="ts">
	import { Upload, FileText, CheckCircle, AlertCircle, Copy } from 'lucide-svelte';
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

	let file = $state<File | null>(null);
	let priority = $state<Priority>('NORMAL');
	let dragOver = $state(false);
	let copied = $state(false);
	let isPending = $state(false);
	let isSuccess = $state(false);
	let isError = $state(false);
	let result = $state<SubmitResult | null>(null);

	let fileInputEl = $state<HTMLInputElement | undefined>(undefined);

	// ─── Handlers ─────────────────────────────────────────────────────────────

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const dropped = e.dataTransfer?.files[0];
		if (dropped) file = dropped;
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
	}
</script>

<svelte:head>
	<title>Nộp hồ sơ — Dịch vụ Công</title>
	<meta name="description" content="Nộp hồ sơ trực tuyến. Tải lên tài liệu PDF hoặc hình ảnh scan." />
</svelte:head>

<div class="mx-auto flex max-w-2xl flex-col justify-center px-4 py-16">
	{#if isSuccess && result}
		<!-- ── Success state ── -->
		<Card class="glass-card text-center animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
			<div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
			<CardHeader class="pt-10">
				<CheckCircle size={56} class="mx-auto mb-4 text-emerald-500" />
				<CardTitle class="text-2xl font-bold tracking-tight">Nộp hồ sơ thành công</CardTitle>
				<CardDescription class="text-base mt-2">
					Hệ thống AI đang xử lý hồ sơ của bạn. <br/> Lưu mã theo dõi bên dưới để tra cứu trạng thái.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div
					class="mb-6 flex items-center justify-between rounded-xl border border-border/50 bg-muted/40 p-5 backdrop-blur-sm"
				>
					<div class="text-left space-y-1">
						<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mã theo dõi</p>
						<p class="font-mono text-xl font-bold text-primary">{result.trackingCode}</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={copyTracking}
						class="gap-2 transition-all hover:bg-primary/10"
					>
						<Copy size={16} />
						{copied ? 'Đã sao chép' : 'Sao chép'}
					</Button>
				</div>
			</CardContent>
			<CardFooter>
				<Button
					onclick={resetForm}
					class="w-full h-12 text-md shadow-lg shadow-primary/20"
				>
					Nộp hồ sơ khác
				</Button>
			</CardFooter>
		</Card>
	{:else}
		<!-- ── Form ── -->
		<div class="mb-10 text-center animate-in fade-in duration-700">
			<h1 class="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
				Cổng Nộp Hồ Sơ AI
			</h1>
			<p class="mt-4 text-lg text-muted-foreground">
				Hệ thống tự động trích xuất thông tin qua <strong class="text-primary font-semibold">Tầm nhìn AI</strong>
			</p>
		</div>

		<Card class="glass-card animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
			<div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/50 to-purple-500/50"></div>
			<form onsubmit={handleSubmit}>
				<CardHeader>
				</CardHeader>
				
				<CardContent class="space-y-8">
					<!-- File drop zone -->
					<div class="space-y-4">
						<Label for="file-input" class="text-base font-semibold">
							Tài liệu hồ sơ <span class="text-destructive">*</span>
						</Label>
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
							class="group relative flex flex-col items-center justify-center cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ease-out
								{dragOver
								? 'border-primary bg-primary/10'
								: file
									? 'border-emerald-500/50 bg-emerald-500/10'
									: 'border-border hover:border-primary/50 hover:bg-muted/50'}"
						>
							{#if file}
								<div class="flex items-center justify-center gap-4">
									<div class="p-3 bg-emerald-500/20 rounded-xl">
										<FileText size={32} class="text-emerald-500" />
									</div>
									<div class="text-left space-y-1">
										<p class="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
										<p class="text-sm font-medium text-emerald-500">Đã chọn thành công • {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
									</div>
								</div>
							{:else}
								<div class="p-4 bg-muted rounded-full mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
									<Upload size={32} class="text-muted-foreground group-hover:text-primary transition-colors" />
								</div>
								<p class="font-semibold text-foreground text-lg">Kéo và thả tệp vào đây</p>
								<p class="mt-2 text-sm font-medium text-muted-foreground">hoặc bấm để duyệt từ máy tính</p>
								<p class="mt-4 text-xs font-medium text-muted-foreground/60 tracking-wider">HỖ TRỢ: PDF, JPG, PNG, TIFF (MAX {MAX_SIZE_MB}MB)</p>
							{/if}
							<input
								id="file-input"
								bind:this={fileInputEl}
								type="file"
								accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
								class="hidden"
								onchange={(e) => (file = (e.target as HTMLInputElement).files?.[0] ?? null)}
							/>
						</div>
					</div>

					<!-- Priority selection -->
					<div class="space-y-4">
						<Label class="text-base font-semibold">Độ ưu tiên xử lý</Label>
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
							{#each PRIORITY_OPTIONS as opt}
								<label
									class="relative flex cursor-pointer flex-col items-center rounded-xl border-2 p-4 text-center transition-all duration-200
										{priority === opt.value
										? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
										: 'border-border/60 hover:border-border hover:bg-muted/30'}"
								>
									<input
										type="radio"
										name="priority"
										value={opt.value}
										bind:group={priority}
										class="sr-only"
									/>
									<span
										class="text-sm font-bold tracking-wide {priority === opt.value
											? 'text-primary'
											: 'text-foreground'}"
									>
										{opt.label}
									</span>
									<span class="mt-1.5 text-xs font-medium text-muted-foreground">{opt.description}</span>
									
									{#if priority === opt.value}
										<div class="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
									{/if}
								</label>
							{/each}
						</div>
					</div>

					<!-- Error -->
					{#if isError}
						<div class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 animate-in slide-in-from-top-2">
							<AlertCircle size={20} class="shrink-0 text-destructive" />
							<p class="text-sm font-medium text-destructive">Máy chủ bận hoặc tệp không hợp lệ. Vui lòng thử lại.</p>
						</div>
					{/if}
				</CardContent>

				<CardFooter class="pt-2 pb-8">
					<Button
						type="submit"
						size="lg"
						disabled={!file || isPending}
						class="w-full relative overflow-hidden group shadow-lg shadow-primary/20 h-14 text-base"
					>
						{#if isPending}
							<span class="absolute inset-0 bg-primary-foreground/20 animate-pulse"></span>
							<span class="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2"></span>
							Đang phân tích AI...
						{:else}
							<Upload size={18} class="mr-2 group-hover:-translate-y-1 transition-transform" />
							Thực hiện nộp hồ sơ
						{/if}
					</Button>
				</CardFooter>
			</form>
		</Card>
	{/if}
</div>

