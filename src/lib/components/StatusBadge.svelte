<script lang="ts">
	import { locale } from '$lib/i18n';
	import { getStatusLabel } from '$lib/api/types';

	const STATUS_STYLES: Record<string, string> = {
		RECEIVED: 'bg-gray-100 text-gray-700',
		PROCESSING: 'bg-blue-100 text-blue-700',
		VALIDATED: 'bg-yellow-100 text-yellow-700',
		REJECTED: 'bg-red-100 text-red-700',
		APPROVED: 'bg-emerald-100 text-emerald-700'
	};
	let { status, class: className = '' }: { status: string; class?: string } = $props();
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {STATUS_STYLES[
		status
	] ?? 'bg-gray-100 text-gray-600'} {className}"
>
	{getStatusLabel(status, $locale)}
</span>
