import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useState } from 'react';
import { CheckCircle, XCircle, Brain } from 'lucide-react';
import { apiClient, type DocumentSummary } from '../api/client.ts';
import PriorityBadge from '../components/PriorityBadge.tsx';

interface DocumentWithSummary extends DocumentSummary {
  extractedData?: {
    summary?: string;
    documentType?: string;
    issuingAuthority?: string;
    subjectName?: string;
  };
}

export default function ApprovalView() {
  const qc = useQueryClient();
  const [selectedDoc, setSelectedDoc] = useState<DocumentWithSummary | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['documents-for-approval'],
    queryFn: () =>
      apiClient
        .get<{ documents: DocumentWithSummary[] }>('/documents', {
          params: { status: 'VALIDATED' },
        })
        .then((r) => r.data),
    refetchInterval: 15_000,
  });

  const approvalMutation = useMutation({
    mutationFn: ({ documentId, approved, reason }: { documentId: string; approved: boolean; reason?: string }) =>
      apiClient.post(`/documents/${documentId}/approve`, { approved, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents-for-approval'] });
      setSelectedDoc(null);
      setRejectionReason('');
    },
  });

  const documents: DocumentWithSummary[] = data?.documents ?? [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Phê duyệt Lãnh đạo</h1>
        <p className="text-gray-500 mt-1">
          {documents.length} hồ sơ chờ phê duyệt
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Document list */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <p className="text-gray-400 py-8 text-center">Đang tải...</p>
          ) : documents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckCircle size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Không có hồ sơ nào chờ phê duyệt</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedDoc?.id === doc.id ? 'border-blue-500 shadow-md' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-xs font-semibold text-blue-700">{doc.trackingCode}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {doc.extractedData?.documentType ?? 'Chưa xác định'}
                    </p>
                  </div>
                  <PriorityBadge priority={doc.priority} />
                </div>
                {doc.slaDeadline && (
                  <p className="text-xs text-gray-400 mt-2">
                    Hạn:{' '}
                    {formatDistanceToNow(new Date(doc.slaDeadline), { addSuffix: true, locale: vi })}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Approval panel */}
        {selectedDoc ? (
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {selectedDoc.extractedData?.documentType ?? 'Hồ sơ'}
            </h2>
            <p className="font-mono text-xs text-blue-700 mb-5">{selectedDoc.trackingCode}</p>

            {/* LLM-generated summary */}
            {selectedDoc.extractedData?.summary && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-4 mb-6">
                <p className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1.5">
                  <Brain size={13} /> Tóm tắt tự động (AI)
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedDoc.extractedData.summary}
                </p>
              </div>
            )}

            {/* Key info */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {selectedDoc.extractedData?.issuingAuthority && (
                <div>
                  <p className="text-xs text-gray-500">Cơ quan ban hành</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedDoc.extractedData.issuingAuthority}
                  </p>
                </div>
              )}
              {selectedDoc.extractedData?.subjectName && (
                <div>
                  <p className="text-xs text-gray-500">Đối tượng</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedDoc.extractedData.subjectName}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Độ tin cậy AI</p>
                <p className={`text-sm font-semibold ${(selectedDoc.aiConfidence ?? 0) >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                  {(selectedDoc.aiConfidence ?? 0).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Mức bảo mật</p>
                <p className="text-sm font-medium text-gray-900">{selectedDoc.securityLevel}</p>
              </div>
            </div>

            {/* Rejection reason input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lý do từ chối (nếu không duyệt)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Nhập lý do từ chối..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() =>
                  approvalMutation.mutate({ documentId: selectedDoc.id, approved: true })
                }
                disabled={approvalMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle size={16} /> Phê duyệt
              </button>
              <button
                onClick={() =>
                  approvalMutation.mutate({
                    documentId: selectedDoc.id,
                    approved: false,
                    reason: rejectionReason,
                  })
                }
                disabled={approvalMutation.isPending || !rejectionReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white rounded-lg py-3 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <XCircle size={16} /> Từ chối
              </button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 bg-white rounded-xl border border-dashed border-gray-300 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Chọn hồ sơ để xem tóm tắt và phê duyệt</p>
          </div>
        )}
      </div>
    </div>
  );
}
