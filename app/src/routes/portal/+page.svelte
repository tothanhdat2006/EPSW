<script lang="ts">
	import { FileText, AlertTriangle, Clock, CheckCircle } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { documentsApi } from '$lib/api/client';
	import type { DocumentSummary } from '$lib/api/types';

	// ─── State ────────────────────────────────────────────────────────────────

	let statusFilter = $state('ALL');
	let documents = $state<DocumentSummary[]>([]);
	let total = $state(0);
	let isLoading = $state(true);

	const STATUS_FILTERS = ['ALL', 'RECEIVED', 'PROCESSING', 'HITL_REVIEW', 'VALIDATED', 'APPROVED', 'REJECTED'];

	// ─── Data fetching ────────────────────────────────────────────────────────

	async function loadDocuments() {
		isLoading = true;
		try {
			const result = await documentsApi.list(
				statusFilter === 'ALL' ? {} : { status: statusFilter }
			);
			documents = result.documents;
			total = result.total;
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		// Re-fetch whenever filter changes
		statusFilter;
		loadDocuments();
	});

	// ─── Stats ────────────────────────────────────────────────────────────────

	const stats = $derived({
		total: total || 0,
		hitlPending: documents.filter((d) => d.status === 'HITL_REVIEW').length,
		slaBreaching: documents.filter((d) => d.slaDeadline && new Date(d.slaDeadline) < new Date()).length,
		approved: documents.filter((d) => d.status === 'APPROVED' || d.status === 'PUBLISHED').length
	});
</script>

<svelte:head>
	<title>Dashboard — DVC Portal</title>
</svelte:head>

<div class="p-8">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
		<p class="mt-1 text-gray-500">Tổng quan hồ sơ trong hệ thống</p>
	</div>

	<!-- Stat cards -->
	<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each [
			{ label: 'Tổng hồ sơ', value: stats.total, icon: FileText, color: 'bg-blue-500' },
			{ label: 'Chờ xử lý thủ công', value: stats.hitlPending, icon: AlertTriangle, color: 'bg-orange-500' },
			{ label: 'Quá hạn SLA', value: stats.slaBreaching, icon: Clock, color: 'bg-red-500' },
			{ label: 'Đã phê duyệt', value: stats.approved, icon: CheckCircle, color: 'bg-green-500' }
		] as card}
			<div class="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
				<div class="rounded-lg p-3 {card.color}">
					<card.icon size={22} class="text-white" />
				</div>
				<div>
					<p class="text-sm text-gray-500">{card.label}</p>
					<p class="text-2xl font-bold text-gray-900">{card.value}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Table card -->
	<div class="rounded-xl border border-gray-200 bg-white shadow-sm">
		<!-- Filter tabs -->
		<div class="flex items-center gap-2 overflow-x-auto border-b border-gray-100 px-6 py-4">
			{#each STATUS_FILTERS as s}
				<button
					onclick={() => (statusFilter = s)}
					class="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
						{statusFilter === s ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}"
				>
					{s === 'ALL' ? 'Tất cả' : s}
				</button>
			{/each}
		</div>

		<!-- Table -->
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="border-b border-gray-100 bg-gray-50">
					<tr>
						{#each ['Mã hồ sơ', 'Trạng thái', 'Ưu tiên', 'AI Score', 'Hạn SLA', 'Thời gian', ''] as col}
							<th class="px-6 py-3 text-left text-sm font-medium text-gray-500">{col}</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-50">
					{#if isLoading}
						<tr>
							<td colspan="7" class="px-6 py-12 text-center text-gray-400">Đang tải...</td>
						</tr>
					{:else if documents.length === 0}
						<tr>
							<td colspan="7" class="px-6 py-12 text-center text-gray-400">Không có hồ sơ nào</td>
						</tr>
					{:else}
						{#each documents as doc}
							<tr class="transition-colors hover:bg-gray-50">
								<td class="px-6 py-4 font-mono text-xs font-semibold text-blue-700">
									{doc.trackingCode}
								</td>
								<td class="px-6 py-4"><StatusBadge status={doc.status} /></td>
								<td class="px-6 py-4"><PriorityBadge priority={doc.priority} /></td>
								<td class="px-6 py-4">
									{#if typeof doc.aiConfidence === 'number'}
										<span class="font-medium {doc.aiConfidence >= 70 ? 'text-green-600' : 'text-red-600'}">
											{doc.aiConfidence.toFixed(1)}%
										</span>
									{:else}
										<span class="text-gray-400">—</span>
									{/if}
								</td>
								<td class="px-6 py-4">
									{#if doc.slaDeadline}
										<span class="{new Date(doc.slaDeadline) < new Date() ? 'font-medium text-red-600' : 'text-gray-600'}">
											{formatDistanceToNow(new Date(doc.slaDeadline), { addSuffix: true, locale: vi })}
										</span>
									{:else}
										<span class="text-gray-400">—</span>
									{/if}
								</td>
								<td class="px-6 py-4 text-gray-500">
									{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true, locale: vi })}
								</td>
								<td class="px-6 py-4">
									<a
										href="/portal/review/{doc.id}"
										class="text-xs font-medium text-blue-600 hover:underline"
									>
										Xem
									</a>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
