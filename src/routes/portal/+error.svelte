<script lang="ts">
	import { page } from '$app/state';
	import { AlertTriangle, Home, LogOut } from 'lucide-svelte';
	import { authClient } from '$lib/auth-client';

	async function logout() {
		await authClient.signOut();
		window.location.href = '/portal/login';
	}
</script>

<svelte:head>
	<title>{page.status} Lỗi truy cập — DVC Admin</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
	<!-- Background glows -->
	<div class="pointer-events-none absolute inset-0">
		<div class="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-destructive/10 blur-[120px]"></div>
		<div class="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[100px]"></div>
	</div>

	<div class="relative z-10 w-full max-w-lg animate-in fade-in zoom-in-95 duration-500">
		<div class="glass-card rounded-3xl border border-border/40 p-10 text-center shadow-2xl relative overflow-hidden">
			<!-- Top accent line -->
			<div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-destructive/50 via-destructive to-destructive/50"></div>
			
			<div class="flex justify-center mb-6">
				<div class="p-4 rounded-full bg-destructive/10 border border-destructive/20 relative">
					<AlertTriangle size={48} class="text-destructive drop-shadow-md" />
				</div>
			</div>

			<h1 class="text-6xl font-black tracking-tighter text-foreground mb-4">
				{page.status}
			</h1>
			
			<div class="space-y-2 mb-8">
				<h2 class="text-xl font-bold text-foreground">
					Truy cập bị từ chối
				</h2>
				<p class="text-sm font-medium text-muted-foreground/80 max-w-sm mx-auto">
					{page.error?.message || 'Bạn không có quyền truy cập vào chức năng này hoặc trang không tồn tại.'}
				</p>
			</div>

			<div class="flex flex-col sm:flex-row items-center justify-center gap-3">
				<a 
					href="/portal"
					class="w-full sm:w-auto px-6 h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
				>
					<Home size={18} /> Về Dashboard
				</a>
				
				<button 
					onclick={logout}
					class="w-full sm:w-auto px-6 h-12 flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 font-bold transition-all active:scale-95 text-muted-foreground hover:text-foreground"
				>
					<LogOut size={18} /> Đăng xuất
				</button>
			</div>
		</div>
		
		<p class="mt-8 text-center text-xs font-black uppercase tracking-widest text-muted-foreground/40">
			Hệ thống dịch vụ công © 2026
		</p>
	</div>
</div>
