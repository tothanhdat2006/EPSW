import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema.js';
import path from 'path';

/**
 * Creates a Drizzle database instance for the given D1 database binding.
 * This works in Cloudflare Workers.
 */
export const getDb = (d1: D1Database) => {
	return drizzleD1(d1, { schema });
};

/**
 * Creates a Drizzle database instance for local Node.js environment
 * using better-sqlite3 pointing to the wrangler local state.
 */
export const getLocalDb = () => {
  // Use the ID from your wrangler.toml or .env
  const dbId = '15abb384-7adc-4238-8686-e7d2c8252b41'; 
  const dbPath = path.resolve(process.cwd(), `.wrangler/state/v3/d1/miniflare-D1Database/${dbId}.sqlite`);
  
  const sqlite = new DatabaseConstructor(dbPath);
  return drizzleSqlite(sqlite, { schema });
};

export type Database = ReturnType<typeof getDb> | ReturnType<typeof getLocalDb>;
