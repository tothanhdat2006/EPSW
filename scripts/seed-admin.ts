import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const USERS = [
	{ email: 'admin@dvc.gov.vn', name: 'Quản trị viên', password: 'Admin@DVC2025!', role: 'admin', department: null },
	{ email: 'motcua@dvc.gov.vn', name: 'Bộ phận Một cửa', password: 'Admin@DVC2025!', role: 'mot_cua', department: null },
	{ email: 'chuyenvien@dvc.gov.vn', name: 'Chuyên viên Sở', password: 'Admin@DVC2025!', role: 'chuyen_vien', department: 'SO_KE_HOACH_DAU_TU' },
	{ email: 'lanhdao@dvc.gov.vn', name: 'Lãnh đạo', password: 'Admin@DVC2025!', role: 'lanh_dao', department: 'SO_KE_HOACH_DAU_TU' },
];

function findSqliteFiles(dir: string) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith('.sqlite') && !f.startsWith('metadata'))
		.map((f) => join(dir, f));
}

async function seedUsers() {
	const baseUrl = process.env.ORIGIN ?? 'http://localhost:5173';
	console.log(`\n🔐 Seeding accounts at ${baseUrl}...\n`);
	
	for (const u of USERS) {
		console.log(`Creating user ${u.email}...`);
		const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Origin': baseUrl },
			body: JSON.stringify({ email: u.email, password: u.password, name: u.name })
		});

		const data = await res.json();
		if (!res.ok && !data?.error?.message?.includes('already exists') && res.status !== 422) {
			console.error('❌ Failed to create user:', data);
		} else {
			console.log(`✅ User ${u.email} ready.`);
		}
	}
	
	console.log('\n⚙️ Patching roles and departments within D1 SQLite...');
	const D1_STATE_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
	const sqliteFiles = findSqliteFiles(D1_STATE_DIR);
	
	if (sqliteFiles.length > 0) {
		for (const dbFile of sqliteFiles) {
			for (const u of USERS) {
				const deptVal = u.department ? `'${u.department}'` : 'NULL';
				const sql = `UPDATE user SET role = '${u.role}', department = ${deptVal} WHERE email = '${u.email}';`;
				try {
					execSync(`sqlite3 "${dbFile}" "${sql}"`);
					console.log(`   Patched ${u.email} -> ${u.role}`);
				} catch (e) {
					console.error(`   Failed to patch ${u.email}`);
				}
			}
		}
	}
}

seedUsers().catch(console.error);
