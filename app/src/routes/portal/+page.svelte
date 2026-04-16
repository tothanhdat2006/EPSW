<script lang="ts">
	import { FileText, AlertTriangle, Clock, CheckCircle } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { documentsApi } from '$lib/api/client';
	import type { DocumentSummary } from '$lib/api/types';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Button } from '$lib/components/ui/button';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';

	// ─── State ────────────────────────────────────────────────────────────────

	let statusFilter = $state('ALL');
	let documents = $state<DocumentSummary[]>([]);
	let total = $state(0);
	let isLoading = $state(true);

	const STATUS_FILTERS = [
		{ value: 'ALL', label: 'Tất cả' },
		{ value: 'RECEIVED', label: 'Mới nhận' },
		{ value: 'PROCESSING', label: 'AI Phân tích' },
		{ value: 'HITL_REVIEW', label: 'Chờ HITL' },
		{ value: 'VALIDATED', label: 'Đã hợp lệ' },
		{ value: 'APPROVED', label: 'Đã phê duyệt' },
		{ value: 'REJECTED', label: 'Từ chối' }
	];

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
	<title>Pulse Dashboard — DVC Admin</title>
</svelte:head>

<div class="space-y-8 p-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
	<div class="flex items-end justify-between">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-foreground">Mission Control</h1>
			<p class="text-sm font-medium text-muted-foreground mt-1">Hệ thống thông minh giám sát lưu lượng hồ sơ theo thời gian thực.</p>
		</div>
	</div>

	<!-- Stat cards -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each [
			{ label: 'Tổng hồ sơ theo dõi', value: stats.total, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
			{ label: 'Chờ xử lý thủ công', value: stats.hitlPending, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
			{ label: 'Cảnh báo SLA', value: stats.slaBreaching, icon: Clock, color: 'text-destructive', bg: 'bg-destructive/10' },
			{ label: 'Hồ sơ đã phê duyệt', value: stats.approved, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
		] as card}
			<Card class="glass-card transition-all hover:scale-[1.02] duration-300">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{card.label}</CardTitle>
					<div class="p-2 rounded-full {card.bg} border border-white/5">
						<card.icon class="h-4 w-4 {card.color}" />
					</div>
				</CardHeader>
				<CardContent>
					{#if isLoading}
						<Skeleton class="h-8 w-20 mt-1" />
					{:else}
						<div class="text-3xl font-bold font-mono tracking-tight text-foreground">{card.value}</div>
					{/if}
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Table card -->
	<Card class="glass-card shadow-2xl overflow-hidden">
		<Tabs bind:value={statusFilter} class="w-full">
			<div class="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center justify-between">
				<TabsList class="bg-background/80 backdrop-blur-md">
					{#each STATUS_FILTERS as s}
						<TabsTrigger value={s.value} class="text-xs font-semibold tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
							{s.label}
						</TabsTrigger>
					{/each}
				</TabsList>
			</div>

			<CardContent class="p-0">
				<div class="overflow-x-auto">
					<Table>
						<TableHeader class="bg-muted/30">
							<TableRow class="hover:bg-transparent">
								<TableHead class="w-[120px] font-semibold tracking-wider text-xs uppercase uppercase">Mã theo dõi</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase">Trạng thái</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase">Ưu tiên</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase text-center">AI Score</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase">Deadline SLA</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase">Cập nhật</TableHead>
								<TableHead class="w-[80px] text-right font-semibold tracking-wider text-xs uppercase">Action</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if isLoading}
								{#each Array(5) as _}
									<TableRow>
										<TableCell><Skeleton class="h-5 w-24" /></TableCell>
										<TableCell><Skeleton class="h-6 w-28 rounded-full" /></TableCell>
										<TableCell><Skeleton class="h-6 w-20 rounded-full" /></TableCell>
										<TableCell class="text-center"><Skeleton class="h-5 w-12 mx-auto" /></TableCell>
										<TableCell><Skeleton class="h-5 w-24" /></TableCell>
										<TableCell><Skeleton class="h-5 w-24" /></TableCell>
										<TableCell class="text-right"><Skeleton class="h-8 w-16 ml-auto" /></TableCell>
									</TableRow>
								{/each}
							{:else if documents.length === 0}
								<TableRow>
									<TableCell colspan={7} class="h-32 text-center text-muted-foreground font-medium">Không tìm thấy hồ sơ nào trong luồng dữ liệu.</TableCell>
								</TableRow>
							{:else}
								{#each documents as doc}
									<TableRow class="group hover:bg-muted/20 transition-colors">
										<TableCell class="font-mono text-xs font-bold text-primary">
											{doc.trackingCode}
										</TableCell>
										<TableCell><StatusBadge status={doc.status} /></TableCell>
										<TableCell><PriorityBadge priority={doc.priority} /></TableCell>
										<TableCell class="text-center">
											{#if typeof doc.aiConfidence === 'number'}
												<div class="inline-flex items-center justify-center border {doc.aiConfidence >= 70 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'} px-2 py-0.5 rounded text-xs font-bold">
													{doc.aiConfidence.toFixed(0)}%
												</div>
											{:else}
												<span class="text-muted-foreground/50">—</span>
											{/if}
										</TableCell>
										<TableCell>
											{#if doc.slaDeadline}
												<span class="text-xs font-medium {new Date(doc.slaDeadline) < new Date() ? 'text-destructive font-bold' : 'text-muted-foreground group-hover:text-foreground transition-colors'}">
													{formatDistanceToNow(new Date(doc.slaDeadline), { addSuffix: true, locale: vi })}
												</span>
											{:else}
												<span class="text-muted-foreground/50">—</span>
											{/if}
										</TableCell>
										<TableCell class="text-xs font-medium text-muted-foreground">
											{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true, locale: vi })}
										</TableCell>
										<TableCell class="text-right">
											<Button href="/portal/review/{doc.id}" variant="secondary" size="sm" class="text-xs h-7 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-semibold">
												Inspect
											</Button>
										</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Tabs>
	</Card>
</div>
