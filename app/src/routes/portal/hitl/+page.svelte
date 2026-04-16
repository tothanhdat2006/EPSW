<script lang="ts">
	import { UserCheck, AlertCircle } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { hitlApi } from '$lib/api/client';
	import type { HitlTask } from '$lib/api/types';

	// ─── Labels ───────────────────────────────────────────────────────────────

	const TASK_TYPE_LABELS: Record<string, string> = {
		OCR_FIX: 'Sửa lỗi OCR',
		AI_REVIEW: 'Kiểm tra AI',
		MANAGER_ESCALATION: 'Leo thang Quản lý',
		PRINT_ISSUE: 'Lỗi in ấn'
	};
	const ROLE_LABELS: Record<string, string> = {
		VAN_THU: 'Văn thư',
		CHUYEN_VIEN: 'Chuyên viên',
		QUAN_LY: 'Quản lý',
		LANH_DAO: 'Lãnh đạo',
		THU_KY: 'Thư ký'
	};

	// ─── State ────────────────────────────────────────────────────────────────

	let tasks = $state<HitlTask[]>([]);
	let isLoading = $state(true);
	let selectedTask = $state<HitlTask | null>(null);
	let resolution = $state('');
	let isClaiming = $state(false);
	let isResolving = $state(false);

	// ─── Data fetching ────────────────────────────────────────────────────────

	async function loadTasks() {
		isLoading = true;
		try {
			const result = await hitlApi.listTasks();
			tasks = result.tasks;
		} finally {
			isLoading = false;
		}
	}

	// Poll every 10 s
	$effect(() => {
		loadTasks();
		const timer = setInterval(loadTasks, 10_000);
		return () => clearInterval(timer);
	});

	async function claimTask(taskId: string) {
		isClaiming = true;
		try {
			await hitlApi.claimTask(taskId);
			await loadTasks();
			// Refresh selected task reference
			if (selectedTask?.id === taskId) {
				selectedTask = tasks.find((t) => t.id === taskId) ?? null;
			}
		} finally {
			isClaiming = false;
		}
	}

	async function resolveTask(taskId: string) {
		isResolving = true;
		try {
			await hitlApi.resolveTask(taskId, {
				manualResolution: resolution,
				resolvedAt: new Date().toISOString()
			});
			await loadTasks();
			selectedTask = null;
			resolution = '';
		} finally {
			isResolving = false;
		}
	}
</script>

<svelte:head>
	<title>Hàng đợi HITL — DVC Portal</title>
</svelte:head>

<div class="p-8">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-gray-900">Hàng đợi HITL</h1>
		<p class="mt-1 text-gray-500">
			Các tác vụ cần xử lý thủ công — {tasks.length} tác vụ đang chờ
		</p>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Task list -->
		<div class="space-y-3">
			{#if isLoading}
				<p class="py-12 text-center text-gray-400">Đang tải...</p>
			{:else if tasks.length === 0}
				<div class="rounded-xl border border-gray-200 bg-white p-12 text-center">
					<AlertCircle size={40} class="mx-auto mb-3 text-gray-300" />
					<p class="text-gray-500">Không có tác vụ nào đang chờ xử lý</p>
				</div>
			{:else}
				{#each tasks as task}
					<button
						onclick={() => (selectedTask = task)}
						class="w-full rounded-xl border bg-white p-4 text-left transition-all hover:shadow-md
							{selectedTask?.id === task.id ? 'border-blue-500 shadow-md' : 'border-gray-200'}"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<p class="truncate font-mono text-xs font-semibold text-blue-700">
									{task.document?.trackingCode ?? task.documentId}
								</p>
								<p class="mt-1 font-medium text-gray-900">
									{TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
								</p>
								<p class="mt-0.5 text-sm text-gray-500">
									Vai trò: {ROLE_LABELS[task.assignedRole] ?? task.assignedRole}
								</p>
							</div>
							<div class="flex shrink-0 flex-col items-end gap-2">
								{#if task.document?.priority}
									<PriorityBadge priority={task.document.priority} />
								{/if}
								<span
									class="rounded-full px-2 py-0.5 text-xs
										{task.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}"
								>
									{task.status === 'PENDING' ? 'Chờ nhận' : 'Đang xử lý'}
								</span>
							</div>
						</div>
						<p class="mt-2 text-xs text-gray-400">
							{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: vi })}
						</p>
					</button>
				{/each}
			{/if}
		</div>

		<!-- Detail / resolution panel -->
		{#if selectedTask}
			<div class="rounded-xl border border-gray-200 bg-white p-6">
				<h2 class="mb-1 text-lg font-semibold text-gray-900">
					{TASK_TYPE_LABELS[selectedTask.taskType] ?? selectedTask.taskType}
				</h2>
				<p class="mb-4 font-mono text-xs text-blue-700">{selectedTask.documentId}</p>

				<div class="mb-6 space-y-3">
					<div class="flex justify-between text-sm">
						<span class="text-gray-500">Trạng thái</span>
						<span class="font-medium">{selectedTask.status}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-gray-500">Vai trò xử lý</span>
						<span class="font-medium">
							{ROLE_LABELS[selectedTask.assignedRole] ?? selectedTask.assignedRole}
						</span>
					</div>
					{#if selectedTask.document?.slaDeadline}
						<div class="flex justify-between text-sm">
							<span class="text-gray-500">Hạn SLA</span>
							<span class="font-medium text-red-600">
								{formatDistanceToNow(new Date(selectedTask.document.slaDeadline), {
									addSuffix: true,
									locale: vi
								})}
							</span>
						</div>
					{/if}
				</div>

				{#if selectedTask.status === 'PENDING'}
					<button
						onclick={() => selectedTask && claimTask(selectedTask.id)}
						disabled={isClaiming}
						class="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600
							py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
					>
						<UserCheck size={16} />
						Nhận tác vụ
					</button>
				{/if}

				{#if selectedTask.status === 'IN_PROGRESS'}
					<div>
						<label for="resolution" class="mb-2 block text-sm font-medium text-gray-700">
							Kết quả xử lý
						</label>
						<textarea
							id="resolution"
							bind:value={resolution}
							placeholder="Nhập kết quả xử lý thủ công..."
							rows={5}
							class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm
								focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						></textarea>
						<button
							onclick={() => selectedTask && resolveTask(selectedTask.id)}
							disabled={!resolution.trim() || isResolving}
							class="mt-3 w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white
								transition-colors hover:bg-green-700 disabled:opacity-50"
						>
							Hoàn thành tác vụ
						</button>
					</div>
				{/if}
			</div>
		{:else}
			<div
				class="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-12"
			>
				<p class="text-sm text-gray-400">Chọn một tác vụ để xem chi tiết</p>
			</div>
		{/if}
	</div>
</div>
