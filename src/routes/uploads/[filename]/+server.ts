import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// In Edge environments, this intercepts requests to /uploads/[id]
// In local dev, Vite intercepts it first if the file was written to static/uploads/.
export const GET: RequestHandler = async ({ params, platform }) => {
	// @ts-ignore Cloudflare bindings
	const storage = (platform?.env as Record<string, unknown> | undefined)?.['STORAGE'] as R2Bucket | undefined;
	
	if (!storage) {
		throw error(404, 'File not found or storage not configured.');
	}

	const object = await storage.get(params.filename);

	if (!object) {
		throw error(404, 'File not found');
	}

	const headers = new Headers();
	if (object.httpMetadata?.contentType) headers.set('content-type', object.httpMetadata.contentType);
	if (object.httpMetadata?.contentLanguage) headers.set('content-language', object.httpMetadata.contentLanguage);
	if (object.httpMetadata?.contentDisposition) headers.set('content-disposition', object.httpMetadata.contentDisposition);
	if (object.httpMetadata?.contentEncoding) headers.set('content-encoding', object.httpMetadata.contentEncoding);
	if (object.httpMetadata?.cacheControl) headers.set('cache-control', object.httpMetadata.cacheControl);
	headers.set('etag', object.httpEtag);

	return new Response(object.body as unknown as BodyInit, {
		headers
	});
};
