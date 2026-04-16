<script lang="ts">
	import { CheckCircle, XCircle, Brain } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { documentsApi } from '$lib/api/client';
	import type { DocumentSummary } from '$lib/api/types';

	interface DocumentWithSummary extends DocumentSummary {
		extractedData?: {
			summary?: string;
			documentType?: string;
			issuingAuthority?: string;
			subjectName?: string;
		};
	}

	// ─── State ────────────────────────────────────────────────────────────────

	let documents = $state<DocumentWithSummary[]>([]);
	let isLoading = $state(true);
	let selectedDoc = $state<DocumentWithSummary | null>(null);
	let rejectionReason = $state('');
	let isActing = $state(false);

	// ─── Data fetching ────────────────────────────────────────────────────────

	async function loadDocuments() {
		isLoading = true;
		try {
			const result = await documentsApi.list({ status: 'VALIDATED' });
			documents = result.documents as DocumentWithSummary[];
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		loadDocuments();
		const timer = setInterval(loadDocuments, 15_000);
		return () => clearInterval(timer);
	});

	async function act(approved: boolean) {
		if (!selectedDoc) return;
		isActing = true;
		try {
			await documentsApi.approve(selectedDoc.id, {
				approved,
				reason: rejectionReason || undefined
			});
			await loadDocuments();
			selectedDoc = null;
			rejectionReason = '';
		} finally {
			isActing = false;
		}
	}
</script>

<svelte:head>
	<title>Phê duyệt Lãnh đạo — DVC Portal</title>
</svelte:head>

<div class="p-8">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-gray-900">Phê duyệt Lãnh đạo</h1>
		<p class="mt-1 text-gray-500">{documents.length} hồ sơ chờ phê duyệt</p>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
		<!-- Document list -->
		<div class="space-y-3 lg:col-span-2">
			{#if isLoading}
				<p class="py-8 text-center text-gray-400">Đang tải...</p>
			{:else if documents.length === 0}
				<div class="rounded-xl border border-gray-200 bg-white p-12 text-center">
					<CheckCircle size={40} class="mx-auto mb-3 text-gray-300" />
					<p class="text-gray-500">Không có hồ sơ nào chờ phê duyệt</p>
				</div>
			{:else}
				{#each documents as doc}
					<button
						onclick={() => (selectedDoc = doc)}
						class="w-full rounded-xl border bg-white p-4 text-left transition-all hover:shadow-md
							{selectedDoc?.id === doc.id ? 'border-blue-500 shadow-md' : 'border-gray-200'}"
					>
						<div class="flex items-start justify-between">
							<div>
								<p class="font-mono text-xs font-semibold text-blue-700">{doc.trackingCode}</p>
								<p class="mt-1 text-sm text-gray-600">
									{doc.extractedData?.documentType ?? 'Chưa xác định'}
								</p>
							</div>
							<PriorityBadge priority={doc.priority} />
						</div>
						{#if doc.slaDeadline}
							<p class="mt-2 text-xs text-gray-400">
								Hạn: {formatDistanceToNow(new Date(doc.slaDeadline), { addSuffix: true, locale: vi })}
							</p>
						{/if}
					</button>
				{/each}
			{/if}
		</div>

		<!-- Approval panel -->
		{#if selectedDoc}
			<div class="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-3">
				<h2 class="mb-1 text-lg font-semibold text-gray-900">
					{selectedDoc.extractedData?.documentType ?? 'Hồ sơ'}
				</h2>
				<p class="mb-5 font-mono text-xs text-blue-700">{selectedDoc.trackingCode}</p>

				<!-- AI Summary -->
				{#if selectedDoc.extractedData?.summary}
					<div
						class="mb-6 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-4"
					>
						<p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-purple-600">
							<Brain size={13} /> Tóm tắt tự động (AI)
						</p>
						<p class="text-sm leading-relaxed text-gray-700">{selectedDoc.extractedData.summary}</p>
					</div>
				{/if}

				<!-- Key info grid -->
				<div class="mb-6 grid grid-cols-2 gap-3">
					{#if selectedDoc.extractedData?.issuingAuthority}
						<div>
							<p class="text-xs text-gray-500">Cơ quan ban hành</p>
							<p class="text-sm font-medium text-gray-900">
								{selectedDoc.extractedData.issuingAuthority}
							</p>
						</div>
					{/if}
					{#if selectedDoc.extractedData?.subjectName}
						<div>
							<p class="text-xs text-gray-500">Đối tượng</p>
							<p class="text-sm font-medium text-gray-900">{selectedDoc.extractedData.subjectName}</p>
						</div>
					{/if}
					<div>
						<p class="text-xs text-gray-500">Độ tin cậy AI</p>
						<p
							class="text-sm font-semibold {(selectedDoc.aiConfidence ?? 0) >= 70
								? 'text-green-600'
								: 'text-red-600'}"
						>
							{(selectedDoc.aiConfidence ?? 0).toFixed(1)}%
						</p>
					</div>
					<div>
						<p class="text-xs text-gray-500">Mức bảo mật</p>
						<p class="text-sm font-medium text-gray-900">{selectedDoc.securityLevel}</p>
					</div>
				</div>

				<!-- Rejection reason -->
				<div class="mb-4">
					<label for="rejection" class="mb-2 block text-sm font-medium text-gray-700">
						Lý do từ chối (nếu không duyệt)
					</label>
					<textarea
						id="rejection"
						bind:value={rejectionReason}
						placeholder="Nhập lý do từ chối..."
						rows={3}
						class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm
							focus:ring-2 focus:ring-red-500 focus:outline-none"
					></textarea>
				</div>

				<!-- Action buttons -->
				<div class="flex gap-3">
					<button
						onclick={() => act(true)}
						disabled={isActing}
						class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-3
							text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
					>
						<CheckCircle size={16} /> Phê duyệt
					</button>
					<button
						onclick={() => act(false)}
						disabled={isActing || !rejectionReason.trim()}
						class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-3
							text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
					>
						<XCircle size={16} /> Từ chối
					</button>
				</div>
			</div>
		{:else}
			<div
				class="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white lg:col-span-3"
			>
				<p class="text-sm text-gray-400">Chọn hồ sơ để xem tóm tắt và phê duyệt</p>
			</div>
		{/if}
	</div>
</div>
