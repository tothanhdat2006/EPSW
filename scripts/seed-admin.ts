import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const USERS = [
	{ email: 'admin@dvc.gov.vn', name: 'Quản trị viên', password: 'Admin@DVC2025!', role: 'admin', department: null },
	{ email: 'motcua@dvc.gov.vn', name: 'Bộ phận Một cửa', password: 'Admin@DVC2025!', role: 'mot_cua', department: null },
	{ email: 'chuyenvien@dvc.gov.vn', name: 'Chuyên viên Sở', password: 'Admin@DVC2025!', role: 'chuyen_vien', department: 'SO_KE_HOACH_DAU_TU' },
	{ email: 'lanhdao@dvc.gov.vn', name: 'Lãnh đạo', password: 'Admin@DVC2025!', role: 'lanh_dao', department: 'SO_KE_HOACH_DAU_TU' },
];

const WRANGLER_CONFIG_FILE = 'wrangler.jsonc';
const DEFAULT_LOCAL_D1_NAME = 'epsw-db';

function getLocalDatabaseName() {
	try {
		const config = readFileSync(WRANGLER_CONFIG_FILE, 'utf8');
		const match = config.match(/"database_name"\s*:\s*"([^"]+)"/);
		if (match?.[1]) return match[1];
	} catch {
		// no-op
	}
	return DEFAULT_LOCAL_D1_NAME;
}

function sqlString(value: string) {
	return `'${value.replace(/'/g, "''")}'`;
}

function runLocalD1Command(databaseName: string, sql: string) {
	const result = spawnSync('npx', ['wrangler', 'd1', 'execute', databaseName, '--local', '--command', `${sql};`], {
		encoding: 'utf8',
		stdio: 'pipe'
	});

	if (result.status === 0) return true;

	const details = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
	if (details) console.error(details);
	return false;
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
	
	console.log('\n⚙️ Patching roles and departments within local D1...');
	const localDbName = getLocalDatabaseName();

	for (const u of USERS) {
		const deptVal = u.department ? sqlString(u.department) : 'NULL';
		const sql = `UPDATE user SET role = ${sqlString(u.role)}, department = ${deptVal} WHERE email = ${sqlString(u.email)}`;

		if (runLocalD1Command(localDbName, sql)) {
			console.log(`   Patched ${u.email} -> ${u.role}`);
		} else {
			console.error(`   Failed to patch ${u.email}`);
		}
	}
}

seedUsers().catch(console.error);
