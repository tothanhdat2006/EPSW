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
    apiClient.get<{ documents: DocumentSummary[]; total: number }>('/documents', { params }),
  get: (documentId: string) =>
    apiClient.get<DocumentSummary>(`/documents/id/${documentId}`),
};

export const hitlApi = {
  listTasks: () => apiClient.get<{ tasks: HitlTask[] }>('/hitl/tasks'),
  getTask: (taskId: string) => apiClient.get<HitlTask>(`/hitl/tasks/${taskId}`),
  claimTask: (taskId: string) => apiClient.post(`/hitl/tasks/${taskId}/claim`),
  resolveTask: (taskId: string, resolutionData: Record<string, unknown>) =>
    apiClient.post(`/hitl/tasks/${taskId}/resolve`, { resolutionData }),
};

export const aiApi = {
  chat: (documentId: string, message: string, history: { role: string; content: string }[]) =>
    apiClient.post<{ response: string }>('/ai/chat', { documentId, message, history }),
  reAnalyze: (documentId: string, trackingCode: string, rawText: string) =>
    apiClient.post('/ai/re-analyze', { documentId, trackingCode, rawText }),
};
