<script lang="ts">
	const PRIORITY_STYLES: Record<string, string> = {
		NORMAL: 'bg-gray-100 text-gray-600',
		URGENT: 'bg-amber-100 text-amber-700',
		FLASH: 'bg-red-100 text-red-700 font-semibold'
	};

	const PRIORITY_LABELS: Record<string, string> = {
		NORMAL: 'Thường',
		URGENT: 'Khẩn',
		FLASH: 'Hỏa tốc'
	};

	let { priority }: { priority: string } = $props();
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs {PRIORITY_STYLES[priority] ??
		'bg-gray-100 text-gray-600'}"
>
	{PRIORITY_LABELS[priority] ?? priority}
</span>
