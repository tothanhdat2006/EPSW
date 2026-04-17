<script lang="ts">
	const STATUS_STYLES: Record<string, string> = {
		RECEIVED: 'bg-gray-100 text-gray-700',
		PROCESSING: 'bg-blue-100 text-blue-700',
		VALIDATED: 'bg-yellow-100 text-yellow-700',
		REJECTED: 'bg-red-100 text-red-700',
		APPROVED: 'bg-emerald-100 text-emerald-700'
	};

	const STATUS_LABELS: Record<string, string> = {
		RECEIVED: 'Đã nhận',
		PROCESSING: 'Đang xử lý',
		VALIDATED: 'Hợp lệ',
		REJECTED: 'Từ chối',
		APPROVED: 'Đã phê duyệt'
	};

	let { status, class: className = '' }: { status: string; class?: string } = $props();
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {STATUS_STYLES[status] ??
		'bg-gray-100 text-gray-600'} {className}"
>
	{STATUS_LABELS[status] ?? status}
</span>
