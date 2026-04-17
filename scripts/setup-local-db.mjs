/**
 * setup-local-db.mjs
 *
 * Applies schema-local.sql to the actual Miniflare D1 SQLite file used at runtime.
 * Also runs idempotent ALTER TABLE migrations for any columns added after initial creation.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const D1_STATE_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const SCHEMA_FILE = 'scripts/schema-local.sql';

// Idempotent ALTER TABLE migrations (columns added after initial table creation)
const MIGRATIONS = [
	"ALTER TABLE user ADD COLUMN banned INTEGER DEFAULT 0",
	"ALTER TABLE user ADD COLUMN ban_reason TEXT",
	"ALTER TABLE user ADD COLUMN ban_expires INTEGER",
	"ALTER TABLE session ADD COLUMN impersonated_by TEXT",
	"ALTER TABLE document ADD COLUMN citizen_cccd TEXT",
	"ALTER TABLE document ADD COLUMN document_type TEXT NOT NULL DEFAULT 'CA_NHAN'",
	"ALTER TABLE user ADD COLUMN department TEXT",
	"ALTER TABLE document ADD COLUMN assigned_by TEXT",
	"ALTER TABLE document ADD COLUMN assignment_note TEXT",
];

function runSql(dbFile, sql) {
	try {
		execSync(`sqlite3 "${dbFile}" "${sql.replace(/"/g, '\\"')};"`, { stdio: 'pipe' });
		return true;
	} catch {
		return false;
	}
}

function findSqliteFiles(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith('.sqlite') && !f.startsWith('metadata'))
		.map((f) => join(dir, f));
}

const sqliteFiles = findSqliteFiles(D1_STATE_DIR);

if (sqliteFiles.length === 0) {
	console.log('⚡ No local D1 found yet — Miniflare will create it on first start.');
	console.log('   If tables are missing after first `pnpm dev`, run `pnpm dev` again.\n');
} else {
	const schema = readFileSync(SCHEMA_FILE, 'utf8');
	const statements = schema
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0 && !s.startsWith('--'));

	for (const dbFile of sqliteFiles) {
		// Apply full schema (CREATE TABLE IF NOT EXISTS — safe to re-run)
		let applied = 0;
		for (const stmt of statements) {
			if (runSql(dbFile, stmt)) applied++;
		}

		// Apply ALTER TABLE migrations (idempotent — errors ignored when column already exists)
		let migrated = 0;
		for (const migration of MIGRATIONS) {
			if (runSql(dbFile, migration)) migrated++;
		}

		console.log(`✅ DB ready: ${dbFile}`);
		if (applied > 0) console.log(`   Schema: ${applied} statements applied`);
		if (migrated > 0) console.log(`   Migrations: ${migrated} columns added`);
	}
}
