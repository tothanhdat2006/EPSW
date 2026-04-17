<script lang="ts">
	import { AlertCircle, ArrowLeft } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Không tìm thấy hồ sơ — DVC Portal</title>
</svelte:head>

<div class="h-full flex items-center justify-center p-8">
	<div class="flex flex-col items-center text-center max-w-sm">
		<div class="h-20 w-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-6">
			<AlertCircle size={40} />
		</div>
		
		<h1 class="text-3xl font-extrabold text-foreground tracking-tight mb-2">Hồ sơ không tồn tại</h1>
		<p class="text-muted-foreground font-medium mb-8">
			Vui lòng chọn hồ sơ từ danh sách để xem chi tiết hoặc kiểm tra lại đường dẫn.
		</p>

		<a
			href="/portal"
			class="h-12 w-full max-w-[200px] flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold hover:scale-105 transition-all shadow-lg"
		>
			<ArrowLeft size={18} />
			Quay lại Dashboard
		</a>
	</div>
</div>
