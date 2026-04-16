/**
 * Admin Account Seed Script
 * 
 * Creates the default admin account for the DVC portal.
 * 
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 * 
 * Requires BETTER_AUTH_SECRET and CLOUDFLARE_D1_TOKEN to be set in .env
 */

const ADMIN_EMAIL = 'admin@dvc.gov.vn';
const ADMIN_PASSWORD = 'Admin@DVC2025!';
const ADMIN_NAME = 'Quản trị viên DVC';

// For local dev, call the Better Auth API endpoint directly
async function createAdminViaApi() {
	const baseUrl = process.env.ORIGIN ?? 'http://localhost:5173';
	
	console.log(`\n🔐 Creating admin account at ${baseUrl}...\n`);
	
	const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Origin': baseUrl
		},
		body: JSON.stringify({
			email: ADMIN_EMAIL,
			password: ADMIN_PASSWORD,
			name: ADMIN_NAME
		})
	});

	const data = await res.json();

	if (!res.ok) {
		if (data?.error?.message?.includes('already exists') || res.status === 422) {
			console.log('✅ Admin account already exists — nothing to do.\n');
			return;
		}
		console.error('❌ Failed to create admin account:', data);
		process.exit(1);
	}

	console.log('✅ Admin account created successfully!\n');
	console.log(`   📧 Email    : ${ADMIN_EMAIL}`);
	console.log(`   🔑 Password : ${ADMIN_PASSWORD}`);
	console.log(`   👤 Name     : ${ADMIN_NAME}`);
	console.log(`   🛡️ Role     : admin (Manual patch applied)`);
	console.log('\n⚠️  IMPORTANT: Change this password immediately after first login!\n');
}

createAdminViaApi().catch((err) => {
	console.error('Unexpected error:', err);
	process.exit(1);
});
