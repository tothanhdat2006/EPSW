<script lang="ts">
	import { locale } from '$lib/i18n';
	import { getDocumentTypeLabel, type DocumentType } from '$lib/api/types';

	const STYLES: Record<DocumentType, string> = {
		CA_NHAN: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
		HO_KINH_DOANH: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
		DOANH_NGHIEP: 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
	};

	let { documentType }: { documentType: DocumentType | string } = $props();
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
	{STYLES[documentType as DocumentType] ?? 'border border-border/30 bg-muted text-muted-foreground'}"
>
	{#if documentType === 'CA_NHAN'}
		👤 {getDocumentTypeLabel(documentType, $locale)}
	{:else if documentType === 'HO_KINH_DOANH'}
		🏪 {getDocumentTypeLabel(documentType, $locale)}
	{:else if documentType === 'DOANH_NGHIEP'}
		🏢 {getDocumentTypeLabel(documentType, $locale)}
	{:else}
		{documentType}
	{/if}
</span>
