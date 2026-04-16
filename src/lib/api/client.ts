/**
 * API client — fetch-based port of apps-legacy/web-portal/src/api/client.ts
 *
 * Supports mock mode via VITE_WEB_DATA_MODE=mock (reads /mock/qwen-data.json).
 * In real mode, calls /api/* on the same origin (proxied to core-api).
 */

import type { DocumentSummary, HitlTask } from './types';

// ─── Config ──────────────────────────────────────────────────────────────────

const WEB_DATA_MODE: string =
	(
		(import.meta as { env?: Record<string, string | undefined> }).env
			?.VITE_WEB_DATA_MODE ?? ''
	).toLowerCase();
const USE_MOCK_DATA = WEB_DATA_MODE === 'mock';

const MOCK_DATA_URL = '/mock/qwen-data.json';
const MOCK_DATA_DETAIL_URL = '/mock/qwen-data-detail.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

function isObjectLike(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null;
}
function toRecord(value: unknown): JsonRecord | null {
	return isObjectLike(value) ? value : null;
}
function pickArray(payload: unknown): JsonRecord[] {
	if (Array.isArray(payload)) return payload.filter(isObjectLike);
	const obj = toRecord(payload);
	if (!obj) return [];
	for (const key of ['documents', 'data', 'items', 'results', 'rows']) {
		const candidate = obj[key];
		if (Array.isArray(candidate)) return candidate.filter(isObjectLike);
	}
	return [];
}
function asString(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim().length > 0) return value.trim();
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return undefined;
}
function asNumber(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim().length > 0) {
		const p = Number(value);
		if (Number.isFinite(p)) return p;
	}
	return undefined;
}
function asIsoDate(value: unknown, fallback: string): string {
	const str = asString(value);
	if (!str) return fallback;
	const d = new Date(str);
	return Number.isNaN(d.valueOf()) ? fallback : d.toISOString();
}
function normalizeStatus(v: unknown) {
	return asString(v)?.toUpperCase() ?? 'RECEIVED';
}
function normalizePriority(v: unknown) {
	return asString(v)?.toUpperCase() ?? 'NORMAL';
}
function normalizeSecurityLevel(v: unknown) {
	return asString(v)?.toUpperCase() ?? 'UNCLASSIFIED';
}

async function loadJson(url: string): Promise<unknown> {
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
	return res.json();
}

function toDetailMap(items: JsonRecord[]): Map<string, JsonRecord> {
	const map = new Map<string, JsonRecord>();
	for (const item of items) {
		const id = asString(item['id']) ?? asString(item['documentId']) ?? asString(item['document_id']);
		const code =
			asString(item['trackingCode']) ?? asString(item['tracking_code']) ?? asString(item['code']);
		if (id) map.set(`id:${id}`, item);
		if (code) map.set(`tracking:${code}`, item);
	}
	return map;
}

function toExtractedData(payload: JsonRecord | null): Record<string, unknown> | undefined {
	if (!payload) return undefined;
	const extracted =
		toRecord(payload['extractedData']) ??
		toRecord(payload['extracted_data']) ??
		toRecord(payload['details']) ??
		toRecord(payload['content']);
	return extracted ?? undefined;
}

function normalizeDocument(base: JsonRecord, detail: JsonRecord | undefined, index: number): DocumentSummary {
	const nowIso = new Date().toISOString();
	const baseId =
		asString(base['id']) ??
		asString(base['documentId']) ??
		asString(base['document_id']) ??
		asString(base['_id']) ??
		asString(detail?.['id']) ??
		crypto.randomUUID();
	const trackingCode =
		asString(base['trackingCode']) ??
		asString(base['tracking_code']) ??
		asString(base['code']) ??
		asString(detail?.['trackingCode']) ??
		`EXT-${String(index + 1).padStart(6, '0')}`;
	const extractedData = toExtractedData(base) ?? toExtractedData(detail ?? null);
	return {
		id: baseId,
		trackingCode,
		status: normalizeStatus(base['status'] ?? detail?.['status']),
		priority: normalizePriority(base['priority'] ?? detail?.['priority']),
		securityLevel: normalizeSecurityLevel(
			base['securityLevel'] ?? base['security_level'] ?? detail?.['securityLevel']
		),
		aiConfidence: asNumber(
			base['aiConfidence'] ?? base['confidence'] ?? base['score'] ?? detail?.['aiConfidence']
		),
		slaDeadline: asString(base['slaDeadline'] ?? base['sla_deadline'] ?? detail?.['slaDeadline']),
		createdAt: asIsoDate(base['createdAt'] ?? base['created_at'] ?? detail?.['createdAt'], nowIso),
		updatedAt: asIsoDate(base['updatedAt'] ?? base['updated_at'] ?? detail?.['updatedAt'], nowIso),
		extractedData
	};
}

// ─── Mock cache ───────────────────────────────────────────────────────────────

let mockDocumentsCache: DocumentSummary[] | null = null;
let mockTasksCache: HitlTask[] | null = null;

async function getMockDocuments(forceReload = false): Promise<DocumentSummary[]> {
	if (mockDocumentsCache && !forceReload) return mockDocumentsCache;
	const [dataResult, detailResult] = await Promise.allSettled([
		loadJson(MOCK_DATA_URL),
		loadJson(MOCK_DATA_DETAIL_URL)
	]);
	const rawData = dataResult.status === 'fulfilled' ? dataResult.value : [];
	const rawDetail = detailResult.status === 'fulfilled' ? detailResult.value : [];
	const dataItems = pickArray(rawData);
	const detailItems = pickArray(rawDetail);
	const detailMap = toDetailMap(detailItems);
	const sourceItems = dataItems.length > 0 ? dataItems : detailItems;
	mockDocumentsCache = sourceItems.map((item, index) => {
		const id = asString(item['id']) ?? asString(item['documentId']) ?? asString(item['document_id']);
		const code =
			asString(item['trackingCode']) ?? asString(item['tracking_code']) ?? asString(item['code']);
		const detail =
			(id ? detailMap.get(`id:${id}`) : undefined) ??
			(code ? detailMap.get(`tracking:${code}`) : undefined);
		return normalizeDocument(item, detail, index);
	});
	return mockDocumentsCache;
}

function buildMockTasks(documents: DocumentSummary[]): HitlTask[] {
	return documents
		.filter((d) => d.status === 'HITL_REVIEW')
		.map((d, i) => ({
			id: `mock-task-${i + 1}`,
			documentId: d.id,
			taskType: 'AI_REVIEW',
			assignedRole: 'CHUYEN_VIEN',
			status: 'PENDING',
			createdAt: d.createdAt,
			document: { trackingCode: d.trackingCode, priority: d.priority, slaDeadline: d.slaDeadline }
		}));
}

async function getMockTasks(forceReload = false): Promise<HitlTask[]> {
	if (mockTasksCache && !forceReload) return mockTasksCache;
	const documents = await getMockDocuments(forceReload);
	mockTasksCache = buildMockTasks(documents);
	return mockTasksCache;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'X-Correlation-ID': crypto.randomUUID(),
		...(init?.headers as Record<string, string> | undefined)
	};
	if (token) headers['Authorization'] = `Bearer ${token}`;
	const res = await fetch(`/api${path}`, { ...init, headers });
	if (res.status === 401) {
		if (typeof localStorage !== 'undefined') localStorage.removeItem('access_token');
		if (typeof window !== 'undefined') window.location.href = '/login';
	}
	if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
	return res.json() as Promise<T>;
}

async function withMockFallback<T>(
	realFn: () => Promise<T>,
	mockFn: () => Promise<T>
): Promise<T> {
	if (USE_MOCK_DATA) return mockFn();
	try {
		return await realFn();
	} catch (err) {
		console.warn('API request failed, falling back to mock data', err);
		return mockFn();
	}
}

// ─── Documents API ────────────────────────────────────────────────────────────

export const documentsApi = {
	list: (params?: { status?: string; priority?: string }) =>
		withMockFallback(
			async () => {
				const qs = new URLSearchParams();
				if (params?.status) qs.set('status', params.status);
				if (params?.priority) qs.set('priority', params.priority);
				return apiFetch<{ documents: DocumentSummary[]; total: number }>(
					`/documents${qs.toString() ? `?${qs}` : ''}`
				);
			},
			async () => {
				const documents = await getMockDocuments();
				const filtered = documents.filter((d) => {
					if (params?.status && d.status !== params.status) return false;
					if (params?.priority && d.priority !== params.priority) return false;
					return true;
				});
				return { documents: filtered, total: filtered.length };
			}
		),

	get: (identifier: string) =>
		withMockFallback(
			async () => {
				try {
					return await apiFetch<DocumentSummary>(`/documents/id/${identifier}`);
				} catch {
					return apiFetch<DocumentSummary>(`/documents/${identifier}`);
				}
			},
			async () => {
				const documents = await getMockDocuments();
				const found = documents.find((d) => d.id === identifier || d.trackingCode === identifier);
				if (!found) throw new Error(`Document not found: ${identifier}`);
				return found;
			}
		),

	getByTrackingCode: (code: string) =>
		withMockFallback(
			() => apiFetch<DocumentSummary>(`/documents/${code}`),
			async () => {
				const documents = await getMockDocuments();
				const found = documents.find((d) => d.trackingCode === code);
				if (!found) throw new Error(`Document not found: ${code}`);
				return found;
			}
		),

	approve: (
		documentId: string,
		payload: { approved: boolean; reason?: string }
	) => apiFetch(`/documents/${documentId}/approve`, { method: 'POST', body: JSON.stringify(payload) }),

	submit: (formData: FormData) =>
		fetch('/api/documents', { method: 'POST', body: formData }).then((r) => {
			if (!r.ok) throw new Error('Submit failed');
			return r.json() as Promise<{ documentId: string; trackingCode: string; status: string; message: string }>;
		})
};

// ─── HITL API ─────────────────────────────────────────────────────────────────

export const hitlApi = {
	listTasks: () =>
		withMockFallback(
			() => apiFetch<{ tasks: HitlTask[] }>('/hitl/tasks'),
			async () => ({ tasks: await getMockTasks() })
		),

	claimTask: (taskId: string) =>
		withMockFallback(
			() => apiFetch(`/hitl/tasks/${taskId}/claim`, { method: 'POST' }),
			async () => {
				const tasks = await getMockTasks();
				const task = tasks.find((t) => t.id === taskId);
				if (!task) throw new Error(`Task not found: ${taskId}`);
				task.status = 'IN_PROGRESS';
				return task;
			}
		),

	resolveTask: (taskId: string, resolutionData: Record<string, unknown>) =>
		withMockFallback(
			() =>
				apiFetch(`/hitl/tasks/${taskId}/resolve`, {
					method: 'POST',
					body: JSON.stringify({ resolutionData })
				}),
			async () => {
				const tasks = await getMockTasks();
				const task = tasks.find((t) => t.id === taskId);
				if (!task) throw new Error(`Task not found: ${taskId}`);
				task.status = 'RESOLVED';
				mockTasksCache = tasks.filter((t) => t.id !== taskId);
				return { taskId, resolutionData, message: 'Resolved in mock mode' };
			}
		)
};

// ─── AI API ───────────────────────────────────────────────────────────────────

export const aiApi = {
	chat: (documentId: string, message: string, history: { role: string; content: string }[]) =>
		apiFetch<{ response?: string; error?: string }>('/ai/chat', {
			method: 'POST',
			body: JSON.stringify({ documentId, message, history })
		}),

	reAnalyze: (documentId: string, trackingCode: string, rawText: string) =>
		apiFetch('/ai/re-analyze', {
			method: 'POST',
			body: JSON.stringify({ documentId, trackingCode, rawText })
		})
};
