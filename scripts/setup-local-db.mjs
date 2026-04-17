/**
 * setup-local-db.mjs
 *
 * Applies schema-local.sql to the actual Miniflare D1 SQLite file used at runtime.
 * Also runs idempotent ALTER TABLE migrations for any columns added after initial creation.
 */
import { execSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const D1_STATE_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const SCHEMA_FILE = 'scripts/schema-local.sql';
const WRANGLER_CONFIG_FILE = 'wrangler.jsonc';
const DEFAULT_LOCAL_D1_NAME = 'epsw-db';

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

function hasSqliteCli() {
	try {
		execSync('sqlite3 --version', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

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

function runWranglerD1(args, allowFailure = false) {
	const result = spawnSync('npx', ['wrangler', 'd1', ...args], {
		encoding: 'utf8',
		stdio: 'pipe'
	});

	if (result.status === 0) return true;
	if (allowFailure) return false;

	const details = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
	throw new Error(details || `Failed command: npx wrangler d1 ${args.join(' ')}`);
}

function findSqliteFiles(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith('.sqlite') && !f.startsWith('metadata'))
		.map((f) => join(dir, f));
}

const sqliteFiles = findSqliteFiles(D1_STATE_DIR);

if (!hasSqliteCli()) {
	const localDbName = getLocalDatabaseName();

	try {
		runWranglerD1(['execute', localDbName, '--local', '--file', SCHEMA_FILE]);

		let migrated = 0;
		for (const migration of MIGRATIONS) {
			if (runWranglerD1(['execute', localDbName, '--local', '--command', `${migration};`], true)) {
				migrated++;
			}
		}

		console.log(`✅ DB ready (wrangler local): ${localDbName}`);
		console.log(`   Schema: applied from ${SCHEMA_FILE}`);
		if (migrated > 0) console.log(`   Migrations: ${migrated} columns added`);
	} catch (e) {
		console.error('❌ Failed to bootstrap local D1 schema via Wrangler.');
		console.error(e instanceof Error ? e.message : e);
		process.exit(1);
	}

	process.exit(0);
}

if (sqliteFiles.length === 0) {
	console.log('⚡ No local D1 found yet — Miniflare will create it on first start.');
	console.log('   If tables are missing after first `pnpm dev`, run `pnpm dev` again.\n');
} else {
	const schema = readFileSync(SCHEMA_FILE, 'utf8');
	const statements = schema
		.split('\n')
		.filter((line) => !line.trim().startsWith('--'))
		.join('\n')
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

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
