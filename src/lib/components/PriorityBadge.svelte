<script lang="ts">
	import type { DocumentType } from '$lib/api/types';

	const STYLES: Record<DocumentType, string> = {
		CA_NHAN:       'bg-blue-500/10 text-blue-400 border border-blue-500/20',
		HO_KINH_DOANH: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
		DOANH_NGHIEP:  'bg-violet-500/10 text-violet-400 border border-violet-500/20'
	};

	const LABELS: Record<DocumentType, string> = {
		CA_NHAN:       '👤 Cá nhân',
		HO_KINH_DOANH: '🏪 Hộ KD',
		DOANH_NGHIEP:  '🏢 Doanh nghiệp'
	};

	let { documentType }: { documentType: DocumentType | string } = $props();
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
	{STYLES[documentType as DocumentType] ?? 'bg-muted text-muted-foreground border border-border/30'}">
	{LABELS[documentType as DocumentType] ?? documentType}
</span>
