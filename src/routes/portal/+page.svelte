<script lang="ts">
	import { FileText, AlertTriangle, Clock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { documentsApi } from '$lib/api/client';
	import type { DocumentSummary } from '$lib/api/types';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';

	let { data } = $props();

	// ─── Constants ────────────────────────────────────────────────────────────

	const PAGE_SIZE = 50;

	const STATUS_FILTERS = [
		{ value: 'ALL', label: 'Tất cả' },
		{ value: 'RECEIVED', label: 'Mới nhận' },
		{ value: 'PROCESSING', label: 'AI Phân tích' },
		{ value: 'VALIDATED', label: 'Đã hợp lệ' },
		{ value: 'APPROVED', label: 'Đã phê duyệt' },
		{ value: 'REJECTED', label: 'Từ chối' }
	];

	// ─── State ────────────────────────────────────────────────────────────────

	let statusFilter = $state('ALL');
	let documents = $state<DocumentSummary[]>([]);
	let total = $state(0);
	let isLoading = $state(true);
	let currentPage = $state(1);

	const totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));
	const pageStart = $derived((currentPage - 1) * PAGE_SIZE + 1);
	const pageEnd = $derived(Math.min(currentPage * PAGE_SIZE, total));

	// ─── Data fetching ────────────────────────────────────────────────────────

	async function loadDocuments(page = currentPage) {
		isLoading = true;
		try {
			const result = await documentsApi.list({
				...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
				page,
				limit: PAGE_SIZE
			});
			documents = result.documents;
			total = result.total;
		} finally {
			isLoading = false;
		}
	}

	function goToPage(page: number) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
		loadDocuments(page);
	}

	// Reset to page 1 when filter changes
	$effect(() => {
		statusFilter;
		currentPage = 1;
		loadDocuments(1);
	});

	// ─── Stats ────────────────────────────────────────────────────────────────

	const stats = $derived({
		total: total || 0,
		slaBreaching: documents.filter((d) => d.slaDeadline && new Date(d.slaDeadline) < new Date() && !['APPROVED','REJECTED','INVALID'].includes(d.status)).length,
		approved: documents.filter((d) => d.status === 'APPROVED').length
	});

	function isSlaBreached(doc: DocumentSummary): boolean {
		if (!doc.slaDeadline) return false;
		if (['APPROVED','REJECTED','INVALID'].includes(doc.status)) return false;
		return new Date(doc.slaDeadline) < new Date();
	}

	const sortedDocuments = $derived([...documents].sort((a, b) => {
		const aBreached = isSlaBreached(a) ? 0 : 1;
		const bBreached = isSlaBreached(b) ? 0 : 1;
		if (aBreached !== bBreached) return aBreached - bBreached;
		return 0; // Preserve server order otherwise
	}));

	// ─── Pagination helpers ───────────────────────────────────────────────────

	function getVisiblePages(current: number, total: number): (number | '…')[] {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		const pages: (number | '…')[] = [1];
		if (current > 3) pages.push('…');
		for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
		if (current < total - 2) pages.push('…');
		pages.push(total);
		return pages;
	}
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
			<div class="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
				<TabsList class="bg-background/80 backdrop-blur-md">
					{#each STATUS_FILTERS as s}
						<TabsTrigger value={s.value} class="text-xs font-semibold tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
							{s.label}
						</TabsTrigger>
					{/each}
				</TabsList>
				{#if !isLoading && total > 0}
					<span class="text-xs text-muted-foreground font-medium">
						{pageStart}–{pageEnd} / {total} hồ sơ
					</span>
				{/if}
			</div>

			<CardContent class="p-0">
				<div class="overflow-x-auto">
					<Table>
						<TableHeader class="bg-muted/30">
							<TableRow class="hover:bg-transparent">
								<TableHead class="w-[120px] font-semibold tracking-wider text-xs uppercase">Mã theo dõi</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase">Trạng thái</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase">Loại hồ sơ</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase">Deadline SLA</TableHead>
								<TableHead class="font-semibold tracking-wider text-xs uppercase">Cập nhật</TableHead>
								<TableHead class="w-[80px] text-right font-semibold tracking-wider text-xs uppercase">Action</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if isLoading}
								{#each Array(10) as _}
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
								{#each sortedDocuments as doc}
									{@const slaBreached = isSlaBreached(doc)}
									<TableRow class="group hover:bg-muted/20 transition-colors {slaBreached ? 'bg-destructive/5 border-l-2 border-destructive' : ''}">
										<TableCell class="font-mono text-xs font-bold text-primary">
											<div class="flex items-center gap-2">
												{#if slaBreached}
													<AlertTriangle size={12} class="text-destructive shrink-0" />
												{/if}
												{doc.trackingCode}
											</div>
										</TableCell>
										<TableCell><StatusBadge status={doc.status} /></TableCell>
										<TableCell><PriorityBadge documentType={doc.documentType} /></TableCell>
										<TableCell>
											{#if doc.slaDeadline}
												<div class="flex flex-col gap-0.5">
													<span class="text-xs font-medium {slaBreached ? 'text-destructive font-bold' : 'text-muted-foreground group-hover:text-foreground transition-colors'}">
														{formatDistanceToNow(new Date(doc.slaDeadline), { addSuffix: true, locale: vi })}
													</span>
													{#if slaBreached}
														<span class="text-[10px] font-bold uppercase tracking-wider text-destructive/80">⚠ QUÁ HẠN</span>
													{/if}
												</div>
											{:else}
												<span class="text-muted-foreground/50">—</span>
											{/if}
										</TableCell>
										<TableCell class="text-xs font-medium text-muted-foreground">
											{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true, locale: vi })}
										</TableCell>
										<TableCell class="text-right">
											<a
												href={doc.status === 'RECEIVED' ? `/portal/reception` : (data.user?.role === 'lanh_dao' ? `/portal/approval/${doc.id}` : `/portal/review/${doc.id}`)}
												class="inline-flex items-center justify-center h-7 px-3 text-xs font-semibold rounded-md
													bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground
													transition-colors border border-primary/20"
											>
												Inspect
											</a>
										</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</div>

				<!-- Pagination bar -->
				{#if !isLoading && totalPages > 1}
					<div class="flex items-center justify-between border-t border-border/40 bg-muted/10 px-6 py-3">
						<button
							onclick={() => goToPage(currentPage - 1)}
							disabled={currentPage === 1}
							class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground
								disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg
								hover:bg-muted/40"
						>
							<ChevronLeft size={14} /> Trước
						</button>

						<div class="flex items-center gap-1">
							{#each getVisiblePages(currentPage, totalPages) as pg}
								{#if pg === '…'}
									<span class="w-8 text-center text-xs text-muted-foreground/50">…</span>
								{:else}
									<button
										onclick={() => goToPage(pg as number)}
										class="w-8 h-8 rounded-lg text-xs font-bold transition-all
											{currentPage === pg
												? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
												: 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
									>
										{pg}
									</button>
								{/if}
							{/each}
						</div>

						<button
							onclick={() => goToPage(currentPage + 1)}
							disabled={currentPage === totalPages}
							class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground
								disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg
								hover:bg-muted/40"
						>
							Tiếp <ChevronRight size={14} />
						</button>
					</div>
				{/if}
			</CardContent>
		</Tabs>
	</Card>
</div>
