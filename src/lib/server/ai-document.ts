import * as mupdf from 'mupdf';
import { getFileBuffer } from '$lib/server/storage';

export type VisionContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } };

export function parseRawFileUrls(rawFileUrl: string | null | undefined): string[] {
	if (!rawFileUrl) return [];

	try {
		return rawFileUrl.trim().startsWith('[')
			? JSON.parse(rawFileUrl)
			: [rawFileUrl];
	} catch {
		return [rawFileUrl];
	}
}

export async function pdfToBase64PngImages(pdfBuffer: Buffer, maxPages = 8): Promise<string[]> {
	const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf') as mupdf.PDFDocument;
	const limit = Math.min(doc.countPages(), maxPages);
	const images: string[] = [];

	for (let i = 0; i < limit; i++) {
		const page = doc.loadPage(i);
		const pixmap = page.toPixmap(
			mupdf.Matrix.scale(1.5, 1.5),
			mupdf.ColorSpace.DeviceRGB,
			false
		);
		images.push(Buffer.from(pixmap.asPNG()).toString('base64'));
		pixmap.destroy();
	}

	doc.destroy();
	return images;
}

export async function appendDocumentFilesAsVisionContent(
	contentParts: VisionContentPart[],
	rawFileUrls: string[],
	platform: App.Platform | undefined,
	options?: {
		logPrefix?: string;
		maxPdfPages?: number;
		fileIntro?: boolean;
	}
): Promise<{ attachedFiles: number; attachedImages: number }> {
	const logPrefix = options?.logPrefix ?? 'ai-doc';
	const maxPdfPages = options?.maxPdfPages ?? 8;
	const includeFileIntro = options?.fileIntro ?? true;

	let attachedFiles = 0;
	let attachedImages = 0;

	for (const [index, rawFileUrl] of rawFileUrls.entries()) {
		const buffer = await getFileBuffer(rawFileUrl, platform);
		if (!buffer) {
			console.warn(`[${logPrefix}] Could not retrieve file buffer for ${rawFileUrl}`);
			continue;
		}

		const filename = rawFileUrl.split('/').pop() || `tep-${index + 1}`;
		const ext = filename.split('.').pop()?.toLowerCase() || '';

		if (includeFileIntro) {
			contentParts.push({
				type: 'text',
				text: `Tệp ${index + 1}: ${filename}`
			});
		}

		if (ext === 'pdf') {
			try {
				const pageImages = await pdfToBase64PngImages(buffer, maxPdfPages);
				for (const [pageIndex, b64] of pageImages.entries()) {
					contentParts.push({
						type: 'text',
						text: `Trang ${pageIndex + 1} của tệp ${index + 1}`
					});
					contentParts.push({
						type: 'image_url',
						image_url: { url: `data:image/png;base64,${b64}` }
					});
					attachedImages++;
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.warn(`[${logPrefix}] PDF render failed for ${filename}: ${message}`);
			}
		} else {
			const mimeType =
				ext === 'webp'
					? 'image/webp'
					: `image/${ext === 'jpg' ? 'jpeg' : ext || 'png'}`;

			contentParts.push({
				type: 'image_url',
				image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` }
			});
			attachedImages++;
		}

		attachedFiles++;
	}

	return { attachedFiles, attachedImages };
}
