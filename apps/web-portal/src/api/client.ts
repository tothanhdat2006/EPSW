import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the Keycloak bearer token from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Correlation-ID'] = crypto.randomUUID();
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

const WEB_DATA_MODE = (
  (
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_WEB_DATA_MODE ?? ''
  ).toLowerCase()
);
const USE_MOCK_DATA = WEB_DATA_MODE === 'mock';
const MOCK_DATA_URL = '/mock/qwen-data.json';
const MOCK_DATA_DETAIL_URL = '/mock/qwen-data-detail.json';

type ApiResponse<T> = { data: T };
type JsonRecord = Record<string, unknown>;

function isObjectLike(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function toRecord(value: unknown): JsonRecord | null {
  return isObjectLike(value) ? value : null;
}

function pickArray(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isObjectLike);
  }

  const obj = toRecord(payload);
  if (!obj) {
    return [];
  }

  for (const key of ['documents', 'data', 'items', 'results', 'rows']) {
    const candidate = obj[key];
    if (Array.isArray(candidate)) {
      return candidate.filter(isObjectLike);
    }
  }

  return [];
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function asIsoDate(value: unknown, fallback: string): string {
  const str = asString(value);
  if (!str) {
    return fallback;
  }

  const date = new Date(str);
  if (Number.isNaN(date.valueOf())) {
    return fallback;
  }

  return date.toISOString();
}

function normalizeStatus(value: unknown): string {
  return asString(value)?.toUpperCase() ?? 'RECEIVED';
}

function normalizePriority(value: unknown): string {
  return asString(value)?.toUpperCase() ?? 'NORMAL';
}

function normalizeSecurityLevel(value: unknown): string {
  return asString(value)?.toUpperCase() ?? 'UNCLASSIFIED';
}

async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json();
}

function toDetailMap(items: JsonRecord[]): Map<string, JsonRecord> {
  const byId = new Map<string, JsonRecord>();

  for (const item of items) {
    const id =
      asString(item['id']) ??
      asString(item['documentId']) ??
      asString(item['document_id']);
    const trackingCode =
      asString(item['trackingCode']) ??
      asString(item['tracking_code']) ??
      asString(item['code']);

    if (id) {
      byId.set(`id:${id}`, item);
    }
    if (trackingCode) {
      byId.set(`tracking:${trackingCode}`, item);
    }
  }

  return byId;
}

function toExtractedData(payload: JsonRecord | null): Record<string, unknown> | undefined {
  if (!payload) {
    return undefined;
  }

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
    asString(detail?.['documentId']) ??
    asString(detail?.['document_id']) ??
    crypto.randomUUID();
  const trackingCode =
    asString(base['trackingCode']) ??
    asString(base['tracking_code']) ??
    asString(base['code']) ??
    asString(detail?.['trackingCode']) ??
    asString(detail?.['tracking_code']) ??
    `EXT-${String(index + 1).padStart(6, '0')}`;

  const extractedData = toExtractedData(base) ?? toExtractedData(detail ?? null);

  return {
    id: baseId,
    trackingCode,
    status: normalizeStatus(base['status'] ?? detail?.['status']),
    priority: normalizePriority(base['priority'] ?? detail?.['priority']),
    securityLevel: normalizeSecurityLevel(base['securityLevel'] ?? base['security_level'] ?? detail?.['securityLevel']),
    aiConfidence: asNumber(base['aiConfidence'] ?? base['confidence'] ?? base['score'] ?? detail?.['aiConfidence']),
    slaDeadline: asString(base['slaDeadline'] ?? base['sla_deadline'] ?? detail?.['slaDeadline']),
    createdAt: asIsoDate(base['createdAt'] ?? base['created_at'] ?? detail?.['createdAt'], nowIso),
    updatedAt: asIsoDate(base['updatedAt'] ?? base['updated_at'] ?? detail?.['updatedAt'], nowIso),
    extractedData,
  };
}

let mockDocumentsCache: DocumentSummary[] | null = null;
let mockTasksCache: HitlTask[] | null = null;

async function getMockDocuments(forceReload = false): Promise<DocumentSummary[]> {
  if (mockDocumentsCache && !forceReload) {
    return mockDocumentsCache;
  }

  const [dataResult, detailResult] = await Promise.allSettled([
    loadJson(MOCK_DATA_URL),
    loadJson(MOCK_DATA_DETAIL_URL),
  ]);

  const rawData = dataResult.status === 'fulfilled' ? dataResult.value : [];
  const rawDetail = detailResult.status === 'fulfilled' ? detailResult.value : [];

  const dataItems = pickArray(rawData);
  const detailItems = pickArray(rawDetail);
  const detailMap = toDetailMap(detailItems);

  const sourceItems = dataItems.length > 0 ? dataItems : detailItems;
  const docs = sourceItems.map((item, index) => {
    const id =
      asString(item['id']) ??
      asString(item['documentId']) ??
      asString(item['document_id']);
    const trackingCode =
      asString(item['trackingCode']) ??
      asString(item['tracking_code']) ??
      asString(item['code']);

    const detail =
      (id ? detailMap.get(`id:${id}`) : undefined) ??
      (trackingCode ? detailMap.get(`tracking:${trackingCode}`) : undefined);

    return normalizeDocument(item, detail, index);
  });

  mockDocumentsCache = docs;
  return docs;
}

function buildMockTasks(documents: DocumentSummary[]): HitlTask[] {
  return documents
    .filter((doc) => doc.status === 'HITL_REVIEW')
    .map((doc, index) => ({
      id: `mock-task-${index + 1}`,
      documentId: doc.id,
      taskType: 'AI_REVIEW',
      assignedRole: 'CHUYEN_VIEN',
      status: 'PENDING',
      createdAt: doc.createdAt,
      document: {
        trackingCode: doc.trackingCode,
        priority: doc.priority,
        slaDeadline: doc.slaDeadline,
      },
    }));
}

async function getMockTasks(forceReload = false): Promise<HitlTask[]> {
  if (mockTasksCache && !forceReload) {
    return mockTasksCache;
  }

  const documents = await getMockDocuments(forceReload);
  mockTasksCache = buildMockTasks(documents);
  return mockTasksCache;
}

async function requestWithFallback<T>(
  request: () => Promise<ApiResponse<T>>,
  fallback: () => Promise<T>,
): Promise<ApiResponse<T>> {
  if (USE_MOCK_DATA) {
    return { data: await fallback() };
  }

  try {
    return await request();
  } catch (error) {
    console.warn('API request failed, fallback to local JSON data', error);
    return { data: await fallback() };
  }
}

export interface DocumentSummary {
  id: string;
  trackingCode: string;
  status: string;
  priority: string;
  securityLevel: string;
  aiConfidence?: number;
  slaDeadline?: string;
  rawFileUrl?: string;
  redactedFileUrl?: string;
  createdAt: string;
  updatedAt: string;
  extractedData?: Record<string, unknown>;
}

export interface HitlTask {
  id: string;
  documentId: string;
  taskType: string;
  assignedRole: string;
  status: string;
  createdAt: string;
  document?: {
    trackingCode: string;
    priority: string;
    slaDeadline?: string;
  };
}

export const documentsApi = {
  list: (params?: { status?: string; priority?: string; page?: number }) =>
    requestWithFallback(
      () =>
        apiClient
          .get<{ documents: DocumentSummary[]; total: number }>('/documents', { params })
          .then((res) => ({ data: res.data })),
      async () => {
        const documents = await getMockDocuments();
        const filtered = documents.filter((doc) => {
          if (params?.status && doc.status !== params.status) {
            return false;
          }
          if (params?.priority && doc.priority !== params.priority) {
            return false;
          }
          return true;
        });

        return { documents: filtered, total: filtered.length };
      },
    ),

  get: (identifier: string) =>
    requestWithFallback(
      () =>
        apiClient
          .get<DocumentSummary>(`/documents/id/${identifier}`)
          .catch(() => apiClient.get<DocumentSummary>(`/documents/${identifier}`))
          .then((res) => ({ data: res.data })),
      async () => {
        const documents = await getMockDocuments();
        const found = documents.find(
          (doc) => doc.id === identifier || doc.trackingCode === identifier,
        );

        if (!found) {
          throw new Error(`Document not found: ${identifier}`);
        }

        return found;
      },
    ),
};

export const hitlApi = {
  listTasks: () =>
    requestWithFallback(
      () =>
        apiClient
          .get<{ tasks: HitlTask[] }>('/hitl/tasks')
          .then((res) => ({ data: res.data })),
      async () => ({ tasks: await getMockTasks() }),
    ),
  getTask: (taskId: string) =>
    requestWithFallback(
      () =>
        apiClient
          .get<HitlTask>(`/hitl/tasks/${taskId}`)
          .then((res) => ({ data: res.data })),
      async () => {
        const tasks = await getMockTasks();
        const found = tasks.find((task) => task.id === taskId);
        if (!found) {
          throw new Error(`Task not found: ${taskId}`);
        }
        return found;
      },
    ),
  claimTask: async (taskId: string) => {
    if (!USE_MOCK_DATA) {
      return apiClient
        .post(`/hitl/tasks/${taskId}/claim`)
        .then((res) => ({ data: res.data }));
    }

    const tasks = await getMockTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    task.status = 'IN_PROGRESS';
    return { data: task };
  },
  resolveTask: (taskId: string, resolutionData: Record<string, unknown>) =>
    USE_MOCK_DATA
      ? getMockTasks().then((tasks) => {
          const task = tasks.find((item) => item.id === taskId);
          if (!task) {
            throw new Error(`Task not found: ${taskId}`);
          }
          task.status = 'RESOLVED';
          mockTasksCache = tasks.filter((item) => item.id !== taskId);
          return { data: { taskId, resolutionData, message: 'Resolved in mock mode' } };
        })
      : apiClient
          .post(`/hitl/tasks/${taskId}/resolve`, { resolutionData })
          .then((res) => ({ data: res.data })),
};

export const aiApi = {
  chat: (documentId: string, message: string, history: { role: string; content: string }[]) =>
    apiClient.post<{ response?: string; error?: string }>('/ai/chat', { documentId, message, history }),
  reAnalyze: (documentId: string, trackingCode: string, rawText: string) =>
    apiClient.post('/ai/re-analyze', { documentId, trackingCode, rawText }),
};
