/**
 * scripts/seed-admin.ts
 *
 * Seeds staff accounts for local development.
 *
 * REQUIREMENTS:
 *   - The dev server must be running first: `pnpm dev`
 *   - Run in a separate terminal: `pnpm seed:admin`
 *
 * VALID ROLES (from src/lib/api/types.ts):
 *   admin       — Full access, no department required
 *   mot_cua     — Reception / intake desk, no department required
 *   chuyen_vien — Specialist reviewer, requires a department
 *   lanh_dao    — Leadership approver, requires a department
 *
 * VALID DEPARTMENTS (from src/lib/api/types.ts):
 *   SO_TAI_NGUYEN_MOI_TRUONG — Sở Tài nguyên và Môi trường
 *   SO_KE_HOACH_DAU_TU       — Sở Kế hoạch và Đầu tư
 *   UBND_TINH                — UBND Tỉnh
 *   UBND_XA                  — UBND Xã
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const USERS = [
	// ── Admins ──────────────────────────────────────────────────────────────
	{
		email: 'admin@dvc.gov.vn',
		name: 'Quản trị viên DVC',
		password: 'Admin@DVC2025!',
		role: 'admin',
		department: null,
	},

	// ── Bộ phận Một cửa (intake) — no department ────────────────────────────
	{
		email: 'motcua@dvc.gov.vn',
		name: 'Bộ phận Một cửa',
		password: 'Admin@DVC2025!',
		role: 'mot_cua',
		department: null,
	},

	// ── Chuyên viên — one per department ────────────────────────────────────
	{
		email: 'cv.tnmt@dvc.gov.vn',
		name: 'Chuyên viên Sở TN&MT',
		password: 'Admin@DVC2025!',
		role: 'chuyen_vien',
		department: 'SO_TAI_NGUYEN_MOI_TRUONG',
	},
	{
		email: 'cv.khdt@dvc.gov.vn',
		name: 'Chuyên viên Sở KH&ĐT',
		password: 'Admin@DVC2025!',
		role: 'chuyen_vien',
		department: 'SO_KE_HOACH_DAU_TU',
	},
	{
		email: 'cv.ubnd@dvc.gov.vn',
		name: 'Chuyên viên UBND Tỉnh',
		password: 'Admin@DVC2025!',
		role: 'chuyen_vien',
		department: 'UBND_TINH',
	},

	// ── Lãnh đạo — one per department ───────────────────────────────────────
	{
		email: 'ld.tnmt@dvc.gov.vn',
		name: 'Lãnh đạo Sở TN&MT',
		password: 'Admin@DVC2025!',
		role: 'lanh_dao',
		department: 'SO_TAI_NGUYEN_MOI_TRUONG',
	},
	{
		email: 'ld.khdt@dvc.gov.vn',
		name: 'Lãnh đạo Sở KH&ĐT',
		password: 'Admin@DVC2025!',
		role: 'lanh_dao',
		department: 'SO_KE_HOACH_DAU_TU',
	},
	{
		email: 'ld.ubnd@dvc.gov.vn',
		name: 'Lãnh đạo UBND Tỉnh',
		password: 'Admin@DVC2025!',
		role: 'lanh_dao',
		department: 'UBND_TINH',
	},
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
	// Use --file instead of --command to avoid Windows shell quoting issues
	const tmpFile = join(tmpdir(), `seed-patch-${Date.now()}.sql`);
	try {
		writeFileSync(tmpFile, sql + ';\n', 'utf8');
		const result = spawnSync(
			'npx',
			['wrangler', 'd1', 'execute', databaseName, '--local', `--file=${tmpFile}`],
			{ encoding: 'utf8', stdio: 'pipe' }
		);
		if (result.status === 0) return true;
		const details = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
		if (details) console.error('\n    ' + details);
		return false;
	} finally {
		try { unlinkSync(tmpFile); } catch { /* ignore */ }
	}
}

async function seedUsers() {
	const baseUrl = process.env.ORIGIN ?? 'http://localhost:5173';
	console.log(`\n🔐 Seeding ${USERS.length} staff accounts at ${baseUrl}...\n`);
	console.log('⚠️  Make sure `pnpm dev` is running before proceeding.\n');

	for (const u of USERS) {
		process.stdout.write(`  Creating ${u.email}... `);
		try {
			const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Origin: baseUrl },
				body: JSON.stringify({ email: u.email, password: u.password, name: u.name }),
			});

			const data = (await res.json()) as { error?: { message?: string } };
			const alreadyExists =
				data?.error?.message?.toLowerCase().includes('already') || res.status === 422;

			if (!res.ok && !alreadyExists) {
				console.error(`\n    ❌ Failed: ${JSON.stringify(data)}`);
			} else {
				console.log(alreadyExists ? '⚠️  already exists' : '✅ created');
			}
		} catch (e) {
			console.error(`\n    ❌ Network error — is dev server running? (${(e as Error).message})`);
		}
	}

	console.log('\n⚙️  Patching roles & departments in local D1...\n');
	const localDbName = getLocalDatabaseName();

	for (const u of USERS) {
		const deptVal = u.department ? sqlString(u.department) : 'NULL';
		const sql = `UPDATE user SET role = ${sqlString(u.role)}, department = ${deptVal} WHERE email = ${sqlString(u.email)}`;

		process.stdout.write(`  Patching ${u.email} → role=${u.role}, dept=${u.department ?? 'none'}... `);
		if (runLocalD1Command(localDbName, sql)) {
			console.log('✅');
		} else {
			console.error('❌ failed');
		}
	}

	console.log('\n✅ Seed complete! Staff accounts ready:\n');
	console.log('  Email                       Password           Role         Department');
	console.log('  ' + '─'.repeat(85));
	for (const u of USERS) {
		const email = u.email.padEnd(30);
		const pass = u.password.padEnd(18);
		const role = u.role.padEnd(12);
		const dept = u.department ?? '—';
		console.log(`  ${email} ${pass} ${role} ${dept}`);
	}
	console.log('\n  🔗 Login at: http://localhost:5173/portal/login\n');
}

seedUsers().catch(console.error);
