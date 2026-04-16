import { defineConfig } from 'drizzle-kit';

const isLocal = !process.env.CLOUDFLARE_D1_TOKEN;

export default defineConfig(
	isLocal
		? {
				schema: './src/lib/server/db/schema.ts',
				dialect: 'sqlite',
				dbCredentials: {
					url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9cf06f70cd1e8d5b1045ce8713291bd602457a0f458ed5a79e58eb993e720c3c.sqlite'
				}
			}
		: {
				schema: './src/lib/server/db/schema.ts',
				dialect: 'sqlite',
				driver: 'd1-http',
				dbCredentials: {
					accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
					databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
					token: process.env.CLOUDFLARE_D1_TOKEN!
				},
				verbose: true,
				strict: true
			}
);
