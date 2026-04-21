<script lang="ts">
	import {
		FileText,
		AlertTriangle,
		Clock,
		CheckCircle,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { getDateLocale, locale } from '$lib/i18n';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import { documentsApi } from '$lib/api/client';
	import type { DocumentSummary } from '$lib/api/types';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';

	let { data } = $props();

	// ─── Constants ────────────────────────────────────────────────────────────

	const PAGE_SIZE = 50;

	const STATUS_FILTERS = $derived(
		$locale === 'en'
			? [
					{ value: 'ALL', label: 'All' },
					{ value: 'RECEIVED', label: 'Received' },
					{ value: 'PROCESSING', label: 'AI Processing' },
					{ value: 'VALIDATED', label: 'Validated' },
					{ value: 'APPROVED', label: 'Approved' },
					{ value: 'REJECTED', label: 'Rejected' }
				]
			: [
					{ value: 'ALL', label: 'Tất cả' },
					{ value: 'RECEIVED', label: 'Mới nhận' },
					{ value: 'PROCESSING', label: 'AI Phân tích' },
					{ value: 'VALIDATED', label: 'Đã hợp lệ' },
					{ value: 'APPROVED', label: 'Đã phê duyệt' },
					{ value: 'REJECTED', label: 'Từ chối' }
				]
	);

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
		slaBreaching: documents.filter(
			(d) =>
				d.slaDeadline &&
				new Date(d.slaDeadline) < new Date() &&
				!['APPROVED', 'REJECTED', 'INVALID'].includes(d.status)
		).length,
		approved: documents.filter((d) => d.status === 'APPROVED').length
	});

	function isSlaBreached(doc: DocumentSummary): boolean {
		if (!doc.slaDeadline) return false;
		if (['APPROVED', 'REJECTED', 'INVALID'].includes(doc.status)) return false;
		return new Date(doc.slaDeadline) < new Date();
	}

	const sortedDocuments = $derived(
		[...documents].sort((a, b) => {
			const aBreached = isSlaBreached(a) ? 0 : 1;
			const bBreached = isSlaBreached(b) ? 0 : 1;
			if (aBreached !== bBreached) return aBreached - bBreached;
			return 0; // Preserve server order otherwise
		})
	);

	// ─── Pagination helpers ───────────────────────────────────────────────────

	function getVisiblePages(current: number, total: number): (number | '…')[] {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		const pages: (number | '…')[] = [1];
		if (current > 3) pages.push('…');
		for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++)
			pages.push(i);
		if (current < total - 2) pages.push('…');
		pages.push(total);
		return pages;
	}

	const ui = $derived(
		$locale === 'en'
			? {
					subtitle: 'Smart monitoring for document flow in real time.',
					totalTracked: 'Total tracked records',
					slaWarnings: 'SLA alerts',
					approved: 'Approved records',
					records: 'records',
					trackingCode: 'Tracking code',
					status: 'Status',
					recordType: 'Record type',
					slaDeadline: 'SLA deadline',
					updated: 'Updated',
					action: 'Action',
					noRecords: 'No records found in the current stream.',
					overdue: 'OVERDUE',
					inspect: 'Inspect',
					prev: 'Previous',
					next: 'Next'
				}
			: {
					subtitle: 'Hệ thống thông minh giám sát lưu lượng hồ sơ theo thời gian thực.',
					totalTracked: 'Tổng hồ sơ theo dõi',
					slaWarnings: 'Cảnh báo SLA',
					approved: 'Hồ sơ đã phê duyệt',
					records: 'hồ sơ',
					trackingCode: 'Mã theo dõi',
					status: 'Trạng thái',
					recordType: 'Loại hồ sơ',
					slaDeadline: 'Deadline SLA',
					updated: 'Cập nhật',
					action: 'Action',
					noRecords: 'Không tìm thấy hồ sơ nào trong luồng dữ liệu.',
					overdue: 'QUÁ HẠN',
					inspect: 'Inspect',
					prev: 'Trước',
					next: 'Tiếp'
				}
	);
</script>

<svelte:head>
	<title>Pulse Dashboard — DVC Admin</title>
</svelte:head>

<div class="mx-auto max-w-[1400px] animate-in space-y-8 p-8 duration-700 fade-in">
	<div class="flex items-end justify-between">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-foreground">Mission Control</h1>
			<p class="mt-1 text-sm font-medium text-muted-foreground">{ui.subtitle}</p>
		</div>
	</div>

	<!-- Stat cards -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each [{ label: ui.totalTracked, value: stats.total, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' }, { label: ui.slaWarnings, value: stats.slaBreaching, icon: Clock, color: 'text-destructive', bg: 'bg-destructive/10' }, { label: ui.approved, value: stats.approved, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }] as card}
			<Card class="glass-card transition-all duration-300 hover:scale-[1.02]">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
						>{card.label}</CardTitle
					>
					<div class="rounded-full p-2 {card.bg} border border-white/5">
						<card.icon class="h-4 w-4 {card.color}" />
					</div>
				</CardHeader>
				<CardContent>
					{#if isLoading}
						<Skeleton class="mt-1 h-8 w-20" />
					{:else}
						<div class="font-mono text-3xl font-bold tracking-tight text-foreground">
							{card.value}
						</div>
					{/if}
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Table card -->
	<Card class="glass-card overflow-hidden shadow-2xl">
		<Tabs bind:value={statusFilter} class="w-full">
			<div
				class="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/20 px-6 py-4"
			>
				<TabsList class="bg-background/80 backdrop-blur-md">
					{#each STATUS_FILTERS as s}
						<TabsTrigger
							value={s.value}
							class="text-xs font-semibold tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
						>
							{s.label}
						</TabsTrigger>
					{/each}
				</TabsList>
				{#if !isLoading && total > 0}
					<span class="text-xs font-medium text-muted-foreground">
						{pageStart}–{pageEnd} / {total}
						{ui.records}
					</span>
				{/if}
			</div>

			<CardContent class="p-0">
				<div class="overflow-x-auto">
					<Table>
						<TableHeader class="bg-muted/30">
							<TableRow class="hover:bg-transparent">
								<TableHead class="w-[120px] text-xs font-semibold tracking-wider uppercase"
									>{ui.trackingCode}</TableHead
								>
								<TableHead class="text-xs font-semibold tracking-wider uppercase"
									>{ui.status}</TableHead
								>
								<TableHead class="text-xs font-semibold tracking-wider uppercase"
									>{ui.recordType}</TableHead
								>
								<TableHead class="text-xs font-semibold tracking-wider uppercase"
									>{ui.slaDeadline}</TableHead
								>
								<TableHead class="text-xs font-semibold tracking-wider uppercase"
									>{ui.updated}</TableHead
								>
								<TableHead
									class="w-[80px] text-right text-xs font-semibold tracking-wider uppercase"
									>{ui.action}</TableHead
								>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if isLoading}
								{#each Array(10) as _}
									<TableRow>
										<TableCell><Skeleton class="h-5 w-24" /></TableCell>
										<TableCell><Skeleton class="h-6 w-28 rounded-full" /></TableCell>
										<TableCell><Skeleton class="h-6 w-20 rounded-full" /></TableCell>
										<TableCell class="text-center"><Skeleton class="mx-auto h-5 w-12" /></TableCell>
										<TableCell><Skeleton class="h-5 w-24" /></TableCell>
										<TableCell><Skeleton class="h-5 w-24" /></TableCell>
										<TableCell class="text-right"><Skeleton class="ml-auto h-8 w-16" /></TableCell>
									</TableRow>
								{/each}
							{:else if documents.length === 0}
								<TableRow>
									<TableCell colspan={7} class="h-32 text-center font-medium text-muted-foreground"
										>{ui.noRecords}</TableCell
									>
								</TableRow>
							{:else}
								{#each sortedDocuments as doc}
									{@const slaBreached = isSlaBreached(doc)}
									<TableRow
										class="group transition-colors hover:bg-muted/20 {slaBreached
											? 'border-l-2 border-destructive bg-destructive/5'
											: ''}"
									>
										<TableCell class="font-mono text-xs font-bold text-primary">
											<div class="flex items-center gap-2">
												{#if slaBreached}
													<AlertTriangle size={12} class="shrink-0 text-destructive" />
												{/if}
												{doc.trackingCode}
											</div>
										</TableCell>
										<TableCell><StatusBadge status={doc.status} /></TableCell>
										<TableCell><PriorityBadge documentType={doc.documentType} /></TableCell>
										<TableCell>
											{#if doc.slaDeadline}
												<div class="flex flex-col gap-0.5">
													<span
														class="text-xs font-medium {slaBreached
															? 'font-bold text-destructive'
															: 'text-muted-foreground transition-colors group-hover:text-foreground'}"
													>
														{formatDistanceToNow(new Date(doc.slaDeadline), {
															addSuffix: true,
															locale: getDateLocale($locale)
														})}
													</span>
													{#if slaBreached}
														<span
															class="text-[10px] font-bold tracking-wider text-destructive/80 uppercase"
															>⚠ {ui.overdue}</span
														>
													{/if}
												</div>
											{:else}
												<span class="text-muted-foreground/50">—</span>
											{/if}
										</TableCell>
										<TableCell class="text-xs font-medium text-muted-foreground">
											{formatDistanceToNow(new Date(doc.createdAt), {
												addSuffix: true,
												locale: getDateLocale($locale)
											})}
										</TableCell>
										<TableCell class="text-right">
											<a
												href={doc.status === 'RECEIVED'
													? `/portal/reception`
													: data.user?.role === 'lanh_dao'
														? `/portal/approval/${doc.id}`
														: `/portal/review/${doc.id}`}
												class="inline-flex h-7 items-center justify-center rounded-md border border-primary/20 bg-primary/10
													px-3 text-xs font-semibold text-primary
													transition-colors hover:bg-primary hover:text-primary-foreground"
											>
												{ui.inspect}
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
					<div
						class="flex items-center justify-between border-t border-border/40 bg-muted/10 px-6 py-3"
					>
						<button
							onclick={() => goToPage(currentPage - 1)}
							disabled={currentPage === 1}
							class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
								font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed
								disabled:opacity-30"
						>
							<ChevronLeft size={14} />
							{ui.prev}
						</button>

						<div class="flex items-center gap-1">
							{#each getVisiblePages(currentPage, totalPages) as pg}
								{#if pg === '…'}
									<span class="w-8 text-center text-xs text-muted-foreground/50">…</span>
								{:else}
									<button
										onclick={() => goToPage(pg as number)}
										class="h-8 w-8 rounded-lg text-xs font-bold transition-all
											{currentPage === pg
											? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
											: 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'}"
									>
										{pg}
									</button>
								{/if}
							{/each}
						</div>

						<button
							onclick={() => goToPage(currentPage + 1)}
							disabled={currentPage === totalPages}
							class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
								font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed
								disabled:opacity-30"
						>
							{ui.next}
							<ChevronRight size={14} />
						</button>
					</div>
				{/if}
			</CardContent>
		</Tabs>
	</Card>
</div>
