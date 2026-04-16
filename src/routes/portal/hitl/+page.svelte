<script lang="ts">
	import { UserCheck, AlertCircle, Clock, ShieldCheck, ClipboardEdit } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { hitlApi } from '$lib/api/client';
	import type { HitlTask } from '$lib/api/types';

	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Label } from '$lib/components/ui/label';

	// ─── Labels ───────────────────────────────────────────────────────────────

	const TASK_TYPE_LABELS: Record<string, string> = {
		OCR_FIX: 'Hiệu chỉnh OCR & AI',
		AI_REVIEW: 'Đối soát kết quả AI',
		MANAGER_ESCALATION: 'Leo thang Quản trị',
		PRINT_ISSUE: 'Xử lý lỗi in ấn/chữ ký số'
	};
	const ROLE_LABELS: Record<string, string> = {
		VAN_THU: 'Văn thư L1',
		CHUYEN_VIEN: 'Chuyên viên L2',
		QUAN_LY: 'Quản lý L3',
		LANH_DAO: 'Lãnh đạo L4',
		THU_KY: 'Thư ký L2'
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
	<title>HITL Queue — DVC Admin</title>
</svelte:head>

<div class="space-y-8 p-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
	<div class="mb-8 border-b border-border/40 pb-6">
		<h1 class="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
			<ClipboardEdit class="text-primary" size={32} /> Human-In-The-Loop (HITL) Queue
		</h1>
		<p class="mt-2 text-sm font-medium text-muted-foreground">
			Các dị thường dữ liệu cần sự can thiệp và phê duyệt của con người — <strong class="text-foreground">{tasks.length} pending</strong>
		</p>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<!-- Task list -->
		<div class="space-y-3 lg:col-span-5 xl:col-span-4 h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar">
			{#if isLoading}
				{#each Array(4) as _}
					<Card class="glass-card opacity-50"><CardContent class="p-4 space-y-3"><Skeleton class="h-4 w-3/4" /><Skeleton class="h-3 w-1/2" /></CardContent></Card>
				{/each}
			{:else if tasks.length === 0}
				<div class="rounded-xl border border-dashed border-border/50 bg-muted/10 p-12 text-center backdrop-blur-sm">
					<ShieldCheck size={48} class="mx-auto mb-4 text-emerald-500/50" />
					<p class="text-emerald-600/80 font-bold tracking-wide">Hệ thống đang hoạt động tối ưu</p>
					<p class="text-xs text-muted-foreground mt-1">Không có lỗi hoặc ngoại lệ nào cần xử lý thủ công.</p>
				</div>
			{:else}
				{#each tasks as task}
					<button
						onclick={() => (selectedTask = task)}
						class="w-full text-left transition-all duration-300 transform active:scale-[0.98]"
					>
						<Card class="glass-card hover:bg-muted/30 hover:border-primary/30 transition-all {selectedTask?.id === task.id ? 'ring-2 ring-primary bg-primary/5 border-primary/50' : ''}">
							<CardContent class="p-4">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1">
										<p class="truncate font-mono text-xs font-bold text-primary tracking-widest uppercase">
											{task.document?.trackingCode ?? task.documentId}
										</p>
										<p class="mt-1.5 font-bold text-foreground text-[15px] leading-tight">
											{TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
										</p>
										<p class="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
											<UserCheck size={12} class="text-primary/70" /> {ROLE_LABELS[task.assignedRole] ?? task.assignedRole}
										</p>
									</div>
									<div class="flex shrink-0 flex-col items-end gap-2">
										{#if task.document?.priority}
											<PriorityBadge priority={task.document.priority} />
										{/if}
										<div
											class="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border
												{task.status === 'PENDING' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-blue-500/10 text-blue-600 border-blue-500/30'}"
										>
											{task.status === 'PENDING' ? 'Chở xử lý' : 'Đang xử lý'}
										</div>
									</div>
								</div>
								<div class="mt-4 pt-3 border-t border-border/40 flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground/70">
									<Clock size={12} /> {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: vi })}
								</div>
							</CardContent>
						</Card>
					</button>
				{/each}
			{/if}
		</div>

		<!-- Detail / resolution panel -->
		<div class="lg:col-span-7 xl:col-span-8">
			{#if selectedTask}
				<Card class="glass-card shadow-2xl animate-in slide-in-from-right-8 duration-500 border-primary/20 sticky top-8">
					<div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-purple-500"></div>
					<CardHeader class="pb-6 border-b border-border/40 bg-muted/10">
						<div class="flex items-start justify-between">
							<div>
								<CardTitle class="text-2xl font-extrabold tracking-tight">
									{TASK_TYPE_LABELS[selectedTask.taskType] ?? selectedTask.taskType}
								</CardTitle>
								<CardDescription class="mt-1 font-mono text-sm tracking-widest text-primary font-bold">
									{selectedTask.documentId}
								</CardDescription>
							</div>
							<div class="p-3 bg-primary/10 rounded-xl border border-primary/20">
								<AlertCircle size={28} class="text-primary" />
							</div>
						</div>
					</CardHeader>
					
					<CardContent class="p-8 space-y-8">
						<div class="grid grid-cols-2 gap-6 bg-muted/20 p-5 rounded-xl border border-border/50 backdrop-blur-sm">
							<div class="space-y-1.5">
								<Label class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Trạng thái công việc</Label>
								<p class="font-bold text-foreground">{selectedTask.status}</p>
							</div>
							<div class="space-y-1.5">
								<Label class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Quyền hạn yêu cầu</Label>
								<p class="font-bold text-foreground">
									{ROLE_LABELS[selectedTask.assignedRole] ?? selectedTask.assignedRole}
								</p>
							</div>
							{#if selectedTask.document?.slaDeadline}
								<div class="space-y-1.5 col-span-2 pt-2 border-t border-border/40">
									<Label class="text-[10px] uppercase tracking-[0.2em] text-destructive font-bold flex items-center gap-1.5">
										<Clock size={12} /> Hạn SLA
									</Label>
									<p class="font-extrabold text-destructive text-lg">
										{formatDistanceToNow(new Date(selectedTask.document.slaDeadline), {
											addSuffix: true,
											locale: vi
										})}
									</p>
								</div>
							{/if}
						</div>

						{#if selectedTask.status === 'PENDING'}
							<div class="pt-4">
								<Button
									size="lg"
									onclick={() => selectedTask && claimTask(selectedTask.id)}
									disabled={isClaiming}
									class="w-full text-[15px] font-bold h-14 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
								>
									<UserCheck size={20} class="mr-2" />
									Tiếp nhận xử lý ngoại lệ
								</Button>
							</div>
						{/if}

						{#if selectedTask.status === 'IN_PROGRESS'}
							<div class="space-y-4 pt-4 border-t border-border/40">
								<div class="space-y-3">
									<Label for="resolution" class="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
										<ClipboardEdit size={16} /> Biên bản xử lý HITL
									</Label>
									<Textarea
										id="resolution"
										bind:value={resolution}
										placeholder="[AI Suggestion] Nhập chi tiết các bước đã xử lý, dữ liệu đã hiệu chỉnh hoặc quyết định được đưa ra..."
										rows={6}
										class="resize-none bg-background border-primary/30 focus-visible:ring-primary shadow-inner text-sm leading-relaxed"
									/>
								</div>
								<Button
									size="lg"
									onclick={() => selectedTask && resolveTask(selectedTask.id)}
									disabled={!resolution.trim() || isResolving}
									class="w-full text-[15px] font-bold h-14 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98]"
								>
									<ShieldCheck size={20} class="mr-2" />
									Đóng tác vụ & Cập nhật hệ thống
								</Button>
							</div>
						{/if}
					</CardContent>
				</Card>
			{:else}
				<div
					class="flex flex-col h-full min-h-[400px] items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/10 p-12 backdrop-blur-sm"
				>
					<div class="p-6 bg-background rounded-full shadow-lg mb-6 border border-border/50">
						<ClipboardEdit size={40} class="text-muted-foreground/40" />
					</div>
					<p class="text-lg font-bold text-foreground">Chưa chọn tác vụ HITL</p>
					<p class="text-sm text-muted-foreground mt-2 max-w-sm text-center">Vui lòng chọn một tác vụ từ danh sách bên trái để xem chi tiết thông tin và thực hiện giải quyết ngoại lệ.</p>
				</div>
			{/if}
		</div>
	</div>
</div>

