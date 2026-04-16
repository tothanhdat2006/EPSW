<script lang="ts">
	import { Upload, FileText, CheckCircle, AlertCircle, Copy } from 'lucide-svelte';

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
	<title>Nộp hồ sơ — Cổng Dịch vụ Công</title>
	<meta name="description" content="Nộp hồ sơ trực tuyến. Tải lên tài liệu PDF hoặc hình ảnh scan." />
</svelte:head>

{#if isSuccess && result}
	<!-- ── Success state ── -->
	<div class="mx-auto max-w-xl px-4 py-16 text-center">
		<div class="rounded-2xl border border-green-100 bg-white p-10 shadow-lg">
			<CheckCircle size={56} class="mx-auto mb-5 text-green-500" />
			<h2 class="mb-2 text-2xl font-bold text-gray-900">Nộp hồ sơ thành công!</h2>
			<p class="mb-6 text-gray-500">
				Hệ thống đang xử lý hồ sơ của bạn. Lưu mã theo dõi bên dưới để tra cứu trạng thái.
			</p>
			<div
				class="mb-6 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4"
			>
				<div class="text-left">
					<p class="mb-1 text-xs text-gray-500">Mã theo dõi</p>
					<p class="font-mono text-lg font-bold text-blue-700">{result.trackingCode}</p>
				</div>
				<button
					onclick={copyTracking}
					class="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-blue-600"
				>
					<Copy size={16} />
					{copied ? 'Đã sao chép!' : 'Sao chép'}
				</button>
			</div>
			<button
				onclick={resetForm}
				class="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
			>
				Nộp hồ sơ khác
			</button>
		</div>
	</div>
{:else}
	<!-- ── Form ── -->
	<div class="mx-auto max-w-2xl px-4 py-12">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold text-gray-900">Nộp hồ sơ trực tuyến</h1>
			<p class="mt-2 text-gray-500">
				Tải lên tài liệu PDF hoặc hình ảnh scan. Hệ thống AI sẽ tự động xử lý.
			</p>
		</div>

		<form
			onsubmit={handleSubmit}
			class="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg"
		>
			<!-- File drop zone -->
			<div>
				<label for="file-input" class="mb-3 block text-sm font-semibold text-gray-700">
					Tài liệu hồ sơ <span class="text-red-500">*</span>
				</label>
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
					class="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all
						{dragOver
						? 'border-blue-500 bg-blue-50'
						: file
							? 'border-green-400 bg-green-50'
							: 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}"
				>
					{#if file}
						<div class="flex items-center justify-center gap-3">
							<FileText size={28} class="text-green-500" />
							<div class="text-left">
								<p class="font-semibold text-gray-900">{file.name}</p>
								<p class="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
							</div>
						</div>
					{:else}
						<Upload size={36} class="mx-auto mb-3 text-gray-400" />
						<p class="font-medium text-gray-700">Kéo thả hoặc nhấp để chọn tệp</p>
						<p class="mt-1 text-sm text-gray-400">PDF, JPEG, PNG, TIFF — tối đa {MAX_SIZE_MB}MB</p>
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
			<div>
				<p class="mb-3 text-sm font-semibold text-gray-700">Mức độ ưu tiên</p>
				<div class="grid grid-cols-3 gap-3">
					{#each PRIORITY_OPTIONS as opt}
						<label
							class="flex cursor-pointer flex-col items-center rounded-xl border-2 p-4 text-center transition-all
								{priority === opt.value
								? 'border-blue-500 bg-blue-50'
								: 'border-gray-200 hover:border-gray-300'}"
						>
							<input
								type="radio"
								name="priority"
								value={opt.value}
								bind:group={priority}
								class="sr-only"
							/>
							<span
								class="text-sm font-bold {priority === opt.value
									? 'text-blue-700'
									: 'text-gray-700'}">{opt.label}</span
							>
							<span class="mt-1 text-xs text-gray-400">{opt.description}</span>
						</label>
					{/each}
				</div>
			</div>

			<!-- Error -->
			{#if isError}
				<div class="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
					<AlertCircle size={20} class="shrink-0 text-red-500" />
					<p class="text-sm text-red-700">Có lỗi xảy ra khi nộp hồ sơ. Vui lòng thử lại.</p>
				</div>
			{/if}

			<!-- Submit -->
			<button
				type="submit"
				disabled={!file || isPending}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm
					font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
			>
				{#if isPending}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
					></span>
					Đang nộp...
				{:else}
					<Upload size={16} />
					Nộp hồ sơ
				{/if}
			</button>
		</form>
	</div>
{/if}
