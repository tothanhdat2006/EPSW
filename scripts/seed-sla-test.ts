/**
 * scripts/seed-sla-test.ts
 *
 * Creates test documents with past/near SLA deadlines to verify the "Cảnh báo SLA"
 * caution system works correctly in the dashboard.
 *
 * Usage:
 *   pnpm seed:sla
 *
 * This generates SQL statements and executes them via wrangler d1 execute.
 * The database name is read from wrangler.toml or defaults to 'DB'.
 */

import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const now = Math.floor(Date.now() / 1000);
const HOURS = (h: number) => h * 60 * 60;

// Test documents with different SLA states
const testDocs = [
	{
		label: '🔴 Quá hạn 3 giờ — RECEIVED',
		slaOffset: -HOURS(3),
		createdOffset: -HOURS(51),
		status: 'RECEIVED',
		documentType: 'CA_NHAN',
		dept: null,
	},
	{
		label: '🔴 Quá hạn 10 giờ — ASSIGNED',
		slaOffset: -HOURS(10),
		createdOffset: -HOURS(58),
		status: 'ASSIGNED',
		documentType: 'HO_KINH_DOANH',
		dept: 'SO_TAI_NGUYEN_MOI_TRUONG',
	},
	{
		label: '🔴 Quá hạn 24 giờ — PROCESSING',
		slaOffset: -HOURS(24),
		createdOffset: -HOURS(72),
		status: 'PROCESSING',
		documentType: 'DU_AN',
		dept: 'SO_KE_HOACH_DAU_TU',
	},
	{
		label: '🟡 Còn 1 giờ — RECEIVED',
		slaOffset: HOURS(1),
		createdOffset: -HOURS(47),
		status: 'RECEIVED',
		documentType: 'CA_NHAN',
		dept: null,
	},
	{
		label: '🟡 Còn 4 giờ — ASSIGNED',
		slaOffset: HOURS(4),
		createdOffset: -HOURS(44),
		status: 'ASSIGNED',
		documentType: 'HO_KINH_DOANH',
		dept: 'UBND_TINH',
	},
	{
		label: '🟢 Còn 24 giờ — RECEIVED (bình thường)',
		slaOffset: HOURS(24),
		createdOffset: -HOURS(24),
		status: 'RECEIVED',
		documentType: 'CA_NHAN',
		dept: null,
	},
	{
		label: '✅ APPROVED — không cảnh báo dù SLA quá hạn',
		slaOffset: -HOURS(5),
		createdOffset: -HOURS(53),
		status: 'APPROVED',
		documentType: 'HO_KINH_DOANH',
		dept: 'SO_TAI_NGUYEN_MOI_TRUONG',
	},
];

const sqlStatements: string[] = [];

for (const doc of testDocs) {
	const id = crypto.randomUUID();
	const trackingCode = `SLA-TEST-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
	const createdAt = now + doc.createdOffset;
	const slaDeadline = now + doc.slaOffset;
	const dept = doc.dept ? `'${doc.dept}'` : 'NULL';

	sqlStatements.push(
		`INSERT OR IGNORE INTO document ` +
		`(id, tracking_code, submitter_id, citizen_email, citizen_cccd, document_type, status, raw_file_url, sla_deadline, assigned_dept, created_at, updated_at) ` +
		`VALUES ('${id}', '${trackingCode}', 'seed-sla-test', 'test@example.com', '999999999', '${doc.documentType}', '${doc.status}', '[]', ${slaDeadline}, ${dept}, ${createdAt}, ${now});`
	);

	console.log(`  ${doc.label} — ${trackingCode}`);
}

// Write SQL to a temp file and execute via wrangler
const tmpFile = path.resolve(__dirname, '../.tmp-seed-sla.sql');
fs.writeFileSync(tmpFile, sqlStatements.join('\n') + '\n');

console.log(`\n📝 Generated ${sqlStatements.length} SQL statements.`);
console.log('🚀 Executing via wrangler d1...\n');

try {
	execSync(`npx wrangler d1 execute DB --local --file="${tmpFile}"`, {
		cwd: path.resolve(__dirname, '..'),
		stdio: 'inherit',
	});
	console.log(`\n✅ SLA test data inserted successfully!`);
	console.log('   Open the staff portal dashboard to see SLA caution indicators.');
} catch (e: any) {
	console.error('\n❌ wrangler d1 execute failed:', e.message);
	console.error('   Make sure you have a local D1 database initialized (run `pnpm dev` first).');
} finally {
	fs.unlinkSync(tmpFile);
}
