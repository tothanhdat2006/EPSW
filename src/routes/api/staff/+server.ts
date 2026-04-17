import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

/**
 * GET /api/staff?role=mot_cua
 * Returns staff users, optionally filtered by role.
 * Requires auth.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	if (!db)          return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const role = url.searchParams.get('role');

	let query = `SELECT id, name, email, role, department, created_at FROM user`;
	const bindings: unknown[] = [];
	if (role) {
		query += ` WHERE role = ?`;
		bindings.push(role);
	}
	query += ` ORDER BY name ASC LIMIT 200`;

	const rows = await db.prepare(query).bind(...bindings).all();

	const staff = (rows.results ?? []).map((r: Record<string, unknown>) => ({
		id:         r['id'],
		name:       r['name'],
		email:      r['email'],
		role:       r['role'],
		department: r['department'] ?? null,
		createdAt:  r['created_at'],
	}));

	return json({ staff });
};
