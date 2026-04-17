import { readFileSync } from 'node:fs';

/**
 * Retrieves the file buffer from R2 or local storage.
 */
export async function getFileBuffer(rawFileUrl: string, platform: App.Platform | undefined): Promise<Buffer | null> {
	try {
		const filename = rawFileUrl.split('/').pop();
		if (!filename) return null;

		// 1. Try R2 Storage
		const storage = (platform?.env as Record<string, unknown> | undefined)?.['STORAGE'] as R2Bucket | undefined;
		if (storage) {
			const obj = await storage.get(filename);
			if (obj) {
				const ab = await obj.arrayBuffer();
				return Buffer.from(ab);
			}
		}

		// 2. Fallback to Local Filesystem (for dev)
		try {
			// In SvelteKit, files are usually uploaded to static/uploads in local dev
			const localPath = `static/uploads/${filename}`;
			return readFileSync(localPath);
		} catch (fsErr) {
			// If not in static/uploads, check relative to root or skip
			return null;
		}
	} catch (e) {
		console.error('[Storage Helper] Failed to get file buffer:', e);
		return null;
	}
}
