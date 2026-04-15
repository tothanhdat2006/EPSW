import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shield, Brain, Calendar, User, Building } from 'lucide-react';
import { documentsApi } from '../api/client.ts';
import StatusBadge from '../components/StatusBadge.tsx';
import PriorityBadge from '../components/PriorityBadge.tsx';

interface ExtractedField {
  key: string;
  label: string;
  value: unknown;
  icon: React.ElementType;
}

export default function DocumentReview() {
  const { documentId } = useParams<{ documentId: string }>();
  const [editedData, setEditedData] = useState<Record<string, string>>({});

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentsApi.get(documentId!).then((r) => r.data),
    enabled: !!documentId,
  });

  if (!documentId) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Chọn một hồ sơ từ Dashboard để xem chi tiết</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-gray-400">Đang tải...</div>;
  }

  if (!document) {
    return <div className="p-8 text-red-500">Không tìm thấy hồ sơ</div>;
  }

  const extracted = (document as unknown as { extractedData?: Record<string, unknown> }).extractedData ?? {};
  const extractedSummary =
    typeof extracted['summary'] === 'string' ? extracted['summary'] : undefined;

  const fields: ExtractedField[] = [
    { key: 'documentType', label: 'Loại hồ sơ', value: extracted['documentType'], icon: Shield },
    { key: 'issuingAuthority', label: 'Cơ quan ban hành', value: extracted['issuingAuthority'], icon: Building },
    { key: 'issueDate', label: 'Ngày ban hành', value: extracted['issueDate'], icon: Calendar },
    { key: 'expiryDate', label: 'Ngày hết hạn', value: extracted['expiryDate'], icon: Calendar },
    { key: 'subjectName', label: 'Tên đối tượng', value: extracted['subjectName'], icon: User },
    { key: 'subjectId', label: 'Mã định danh', value: extracted['subjectId'], icon: User },
    { key: 'purpose', label: 'Mục đích', value: extracted['purpose'], icon: Brain },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kiểm duyệt hồ sơ</h1>
          <p className="font-mono text-sm text-blue-700 mt-1">{document.trackingCode}</p>
        </div>
        <div className="flex items-center gap-3">
          <PriorityBadge priority={document.priority} />
          <StatusBadge status={document.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Analysis Summary */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Brain size={16} className="text-purple-500" /> Phân tích AI
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Độ tin cậy</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (document.aiConfidence ?? 0) >= 70 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${document.aiConfidence ?? 0}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      (document.aiConfidence ?? 0) >= 70 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {(document.aiConfidence ?? 0).toFixed(1)}%
                  </span>
                </div>
                {(document.aiConfidence ?? 0) < 70 && (
                  <p className="text-xs text-red-500 mt-1">
                    Dưới ngưỡng 70% — cần xét duyệt thủ công
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Mức bảo mật</p>
                <p className="font-medium text-gray-900">{document.securityLevel}</p>
              </div>
              {document.slaDeadline && (
                <div>
                  <p className="text-xs text-gray-500">Hạn SLA</p>
                  <p className="font-medium text-gray-900">
                    {new Date(document.slaDeadline).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {extractedSummary && (
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
              <h2 className="text-sm font-semibold text-purple-700 mb-2">Tóm tắt nội dung</h2>
              <p className="text-sm text-purple-800">{extractedSummary}</p>
            </div>
          )}
        </div>

        {/* Extracted Data - editable fields */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">
            Dữ liệu trích xuất — có thể chỉnh sửa
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ key, label, value, icon: Icon }) => (
              <div key={key}>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                  <Icon size={12} />
                  {label}
                </label>
                <input
                  type="text"
                  defaultValue={(value as string) ?? ''}
                  onChange={(e) =>
                    setEditedData((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
          </div>

          {Object.keys(editedData).length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-100 flex justify-end">
              <button className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
                Lưu chỉnh sửa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
