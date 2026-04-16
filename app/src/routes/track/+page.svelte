<script lang="ts">
	import { Search, Clock, CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-svelte';
	import { format, formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import type { DocumentSummary } from '$lib/api/types';

	// ─── Status config ─────────────────────────────────────────────────────────

	const STATUS_STEPS = [
		{ key: 'RECEIVED', label: 'Đã nhận hồ sơ', icon: CheckCircle },
		{ key: 'PROCESSING', label: 'Đang xử lý', icon: Loader },
		{ key: 'HITL_REVIEW', label: 'Kiểm tra thủ công', icon: AlertTriangle },
		{ key: 'VALIDATED', label: 'Hợp lệ — Chờ phê duyệt', icon: Clock },
		{ key: 'APPROVED', label: 'Đã phê duyệt', icon: CheckCircle },
		{ key: 'PUBLISHED', label: 'Đã phát hành', icon: CheckCircle }
	];

	const STATUS_DESCRIPTIONS: Record<string, string> = {
		RECEIVED: 'Hệ thống đã nhận được hồ sơ của bạn và đang chuẩn bị xử lý.',
		PROCESSING: 'Hệ thống AI đang phân tích và trích xuất thông tin từ hồ sơ.',
		HITL_REVIEW: 'Chuyên viên đang kiểm tra và xác minh nội dung hồ sơ.',
		VALIDATED: 'Hồ sơ đã được xác nhận hợp lệ và đang chờ lãnh đạo phê duyệt.',
		APPROVED: 'Lãnh đạo đã phê duyệt. Hồ sơ đang được xử lý cuối cùng.',
		PUBLISHED: 'Hồ sơ đã được phát hành. Kết quả đã được gửi đến bạn.',
		REJECTED: 'Hồ sơ không đáp ứng yêu cầu. Vui lòng kiểm tra email để biết lý do.'
	};

	const PRIORITY_LABELS: Record<string, string> = { NORMAL: 'Thường', URGENT: 'Khẩn', FLASH: 'Hỏa tốc' };

	function getStepIndex(status: string): number {
		if (status === 'REJECTED') return -1;
		return STATUS_STEPS.findIndex((s) => s.key === status);
	}

	// ─── State ─────────────────────────────────────────────────────────────────

	let trackingInput = $state('');
	let submittedCode = $state('');
	let data = $state<DocumentSummary | null>(null);
	let isLoading = $state(false);
	let isError = $state(false);
	let errorMessage = $state('');

	let pollingTimer: ReturnType<typeof setInterval> | null = null;

	// ─── Fetch logic ───────────────────────────────────────────────────────────

	async function fetchStatus(code: string) {
		isLoading = true;
		isError = false;
		try {
			const res = await fetch(`/api/documents/${code}`);
			if (!res.ok) throw new Error(res.status === 404 ? 'Không tìm thấy hồ sơ.' : `Lỗi ${res.status}`);
			data = await res.json();
			// Auto-poll while still actively processing
			if (pollingTimer) clearInterval(pollingTimer);
			if (data?.status === 'RECEIVED' || data?.status === 'PROCESSING') {
				pollingTimer = setInterval(() => fetchStatus(code), 5000);
			}
		} catch (e) {
			isError = true;
			errorMessage = e instanceof Error ? e.message : 'Mã theo dõi không đúng hoặc hồ sơ chưa được đăng ký.';
			data = null;
		} finally {
			isLoading = false;
		}
	}

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		if (!trackingInput.trim()) return;
		submittedCode = trackingInput.trim().toUpperCase();
		fetchStatus(submittedCode);
	}

	$effect(() => () => {
		if (pollingTimer) clearInterval(pollingTimer);
	});

	// ── Derived ────────────────────────────────────────────────────────────────
	const currentStepIndex = $derived(data ? getStepIndex(data.status) : -1);
	const isRejected = $derived(data?.status === 'REJECTED');
</script>

<svelte:head>
	<title>Tra cứu hồ sơ — Cổng Dịch vụ Công</title>
	<meta name="description" content="Nhập mã theo dõi để kiểm tra trạng thái hồ sơ của bạn." />
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-12">
	<div class="mb-8 text-center">
		<h1 class="text-3xl font-bold text-gray-900">Tra cứu hồ sơ</h1>
		<p class="mt-2 text-gray-500">Nhập mã theo dõi để kiểm tra trạng thái hồ sơ</p>
	</div>

	<!-- Search form -->
	<form onsubmit={handleSearch} class="mb-8 flex gap-3">
		<input
			id="tracking-input"
			type="text"
			bind:value={trackingInput}
			placeholder="VD: DVC-1736000000000-ABCD1234"
			class="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm
				focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
		<button
			type="submit"
			disabled={!trackingInput.trim()}
			class="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold
				text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
		>
			<Search size={16} />
			Tra cứu
		</button>
	</form>

	<!-- Loading -->
	{#if isLoading}
		<div class="py-16 text-center">
			<Loader size={36} class="mx-auto mb-3 animate-spin text-blue-500" />
			<p class="text-gray-500">Đang tìm kiếm...</p>
		</div>
	{/if}

	<!-- Error -->
	{#if isError}
		<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
			<XCircle size={32} class="mx-auto mb-3 text-red-400" />
			<p class="font-semibold text-red-700">Không tìm thấy hồ sơ</p>
			<p class="mt-1 text-sm text-red-500">{errorMessage}</p>
		</div>
	{/if}

	<!-- Result -->
	{#if data && !isLoading}
		<div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
			<!-- Header band -->
			<div class="{isRejected ? 'bg-red-600' : 'bg-blue-600'} px-6 py-5">
				<p class="mb-1 text-xs font-medium text-blue-200">Mã theo dõi</p>
				<p class="font-mono text-xl font-bold text-white">{data.trackingCode}</p>
				<p class="mt-1 text-sm text-blue-200">
					Nộp lúc: {format(new Date(data.createdAt), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi })}
				</p>
			</div>

			<div class="p-6">
				<!-- Status description -->
				<div
					class="mb-6 rounded-xl p-4 {isRejected
						? 'border border-red-200 bg-red-50'
						: 'border border-blue-200 bg-blue-50'}"
				>
					<p class="font-semibold {isRejected ? 'text-red-700' : 'text-blue-700'}">
						{isRejected
							? 'Hồ sơ bị từ chối'
							: (STATUS_STEPS[currentStepIndex]?.label ?? data.status)}
					</p>
					<p class="mt-1 text-sm {isRejected ? 'text-red-600' : 'text-blue-600'}">
						{STATUS_DESCRIPTIONS[data.status] ?? 'Đang cập nhật...'}
					</p>
				</div>

				<!-- Progress timeline -->
				{#if !isRejected}
					<div class="mb-6 space-y-3">
						{#each STATUS_STEPS.filter((s) => s.key !== 'HITL_REVIEW' || data?.status === 'HITL_REVIEW') as step, index}
							{@const stepDone = index < currentStepIndex}
							{@const stepActive = index === currentStepIndex}
							<div class="flex items-center gap-4">
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
										{stepDone ? 'bg-green-500' : stepActive ? 'animate-pulse bg-blue-600' : 'bg-gray-200'}"
								>
									<step.icon
										size={14}
										class={stepDone || stepActive ? 'text-white' : 'text-gray-400'}
									/>
								</div>
								<span
									class="text-sm
										{stepDone
										? 'font-medium text-green-700'
										: stepActive
											? 'font-semibold text-blue-700'
											: 'text-gray-400'}"
								>
									{step.label}
								</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="mb-6 flex items-center gap-4">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
							<XCircle size={14} class="text-white" />
						</div>
						<span class="text-sm font-semibold text-red-700">Bị từ chối</span>
					</div>
				{/if}

				<!-- Meta grid -->
				<div class="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm">
					<div>
						<p class="text-gray-500">Ưu tiên</p>
						<p class="font-medium text-gray-900">{PRIORITY_LABELS[data.priority] ?? data.priority}</p>
					</div>
					<div>
						<p class="text-gray-500">Cập nhật lần cuối</p>
						<p class="font-medium text-gray-900">
							{formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true, locale: vi })}
						</p>
					</div>
					{#if data.slaDeadline}
						<div class="col-span-2">
							<p class="text-gray-500">Hạn xử lý</p>
							<p
								class="font-medium {new Date(data.slaDeadline) < new Date()
									? 'text-red-600'
									: 'text-gray-900'}"
							>
								{format(new Date(data.slaDeadline), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi })}
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
