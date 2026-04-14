import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Search, Clock, CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import clsx from 'clsx';

interface DocumentStatus {
  id: string;
  trackingCode: string;
  status: string;
  priority: string;
  slaDeadline?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STEPS = [
  { key: 'RECEIVED', label: 'Đã nhận hồ sơ', icon: CheckCircle },
  { key: 'PROCESSING', label: 'Đang xử lý', icon: Loader },
  { key: 'HITL_REVIEW', label: 'Kiểm tra thủ công', icon: AlertTriangle },
  { key: 'VALIDATED', label: 'Hợp lệ — Chờ phê duyệt', icon: Clock },
  { key: 'APPROVED', label: 'Đã phê duyệt', icon: CheckCircle },
  { key: 'PUBLISHED', label: 'Đã phát hành', icon: CheckCircle },
];

const REJECTED_STEP = { key: 'REJECTED', label: 'Bị từ chối', icon: XCircle };

const STATUS_DESCRIPTIONS: Record<string, string> = {
  RECEIVED: 'Hệ thống đã nhận được hồ sơ của bạn và đang chuẩn bị xử lý.',
  PROCESSING: 'Hệ thống AI đang phân tích và trích xuất thông tin từ hồ sơ.',
  HITL_REVIEW: 'Chuyên viên đang kiểm tra và xác minh nội dung hồ sơ.',
  VALIDATED: 'Hồ sơ đã được xác nhận hợp lệ và đang chờ lãnh đạo phê duyệt.',
  APPROVED: 'Lãnh đạo đã phê duyệt. Hồ sơ đang được xử lý cuối cùng.',
  PUBLISHED: 'Hồ sơ đã được phát hành. Kết quả đã được gửi đến bạn.',
  REJECTED: 'Hồ sơ không đáp ứng yêu cầu. Vui lòng kiểm tra email để biết lý do.',
};

function getStepIndex(status: string): number {
  if (status === 'REJECTED') return -1;
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

export default function TrackDocument() {
  const [trackingCode, setTrackingCode] = useState('');
  const [submittedCode, setSubmittedCode] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['track', submittedCode],
    queryFn: () =>
      axios.get<DocumentStatus>(`/api/documents/${submittedCode}`).then((r) => r.data),
    enabled: !!submittedCode,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RECEIVED' || status === 'PROCESSING' ? 5000 : false;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      setSubmittedCode(trackingCode.trim().toUpperCase());
    }
  };

  const currentStepIndex = data ? getStepIndex(data.status) : -1;
  const isRejected = data?.status === 'REJECTED';

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tra cứu hồ sơ</h1>
        <p className="text-gray-500 mt-2">Nhập mã theo dõi để kiểm tra trạng thái hồ sơ</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="text"
          value={trackingCode}
          onChange={(e) => setTrackingCode(e.target.value)}
          placeholder="VD: DVC-1736000000000-ABCD1234"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
        />
        <button
          type="submit"
          disabled={!trackingCode.trim()}
          className="bg-blue-600 text-white rounded-xl px-6 py-3 font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          <Search size={16} />
          Tra cứu
        </button>
      </form>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-16">
          <Loader size={36} className="mx-auto text-blue-500 animate-spin mb-3" />
          <p className="text-gray-500">Đang tìm kiếm...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <XCircle size={32} className="mx-auto text-red-400 mb-3" />
          <p className="font-semibold text-red-700">Không tìm thấy hồ sơ</p>
          <p className="text-sm text-red-500 mt-1">
            {(error as Error)?.message ?? 'Mã theo dõi không đúng hoặc hồ sơ chưa được đăng ký.'}
          </p>
        </div>
      )}

      {/* Result */}
      {data && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div
            className={clsx(
              'px-6 py-5',
              isRejected ? 'bg-red-600' : 'bg-blue-600',
            )}
          >
            <p className="text-xs text-blue-200 font-medium mb-1">Mã theo dõi</p>
            <p className="font-mono font-bold text-white text-xl">{data.trackingCode}</p>
            <p className="text-blue-200 text-sm mt-1">
              Nộp lúc: {format(new Date(data.createdAt), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi })}
            </p>
          </div>

          <div className="p-6">
            {/* Current status description */}
            <div
              className={clsx(
                'rounded-xl p-4 mb-6',
                isRejected ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200',
              )}
            >
              <p className={clsx('font-semibold', isRejected ? 'text-red-700' : 'text-blue-700')}>
                {isRejected ? 'Hồ sơ bị từ chối' : STATUS_STEPS[currentStepIndex]?.label ?? data.status}
              </p>
              <p className={clsx('text-sm mt-1', isRejected ? 'text-red-600' : 'text-blue-600')}>
                {STATUS_DESCRIPTIONS[data.status] ?? 'Đang cập nhật...'}
              </p>
            </div>

            {/* Progress timeline */}
            {!isRejected && (
              <div className="space-y-3 mb-6">
                {STATUS_STEPS.filter((s) => s.key !== 'HITL_REVIEW' || data.status === 'HITL_REVIEW').map(
                  (step, index) => {
                    const stepDone = index < currentStepIndex;
                    const stepActive = index === currentStepIndex;
                    const Icon = step.icon;

                    return (
                      <div key={step.key} className="flex items-center gap-4">
                        <div
                          className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                            stepDone
                              ? 'bg-green-500'
                              : stepActive
                                ? 'bg-blue-600 animate-pulse'
                                : 'bg-gray-200',
                          )}
                        >
                          <Icon
                            size={14}
                            className={stepDone || stepActive ? 'text-white' : 'text-gray-400'}
                          />
                        </div>
                        <span
                          className={clsx(
                            'text-sm',
                            stepDone
                              ? 'text-green-700 font-medium'
                              : stepActive
                                ? 'text-blue-700 font-semibold'
                                : 'text-gray-400',
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            )}

            {isRejected && (
              <div className="flex items-center gap-4 mb-6">
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                  <XCircle size={14} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-red-700">{REJECTED_STEP.label}</span>
              </div>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3 text-sm pt-4 border-t border-gray-100">
              <div>
                <p className="text-gray-500">Ưu tiên</p>
                <p className="font-medium text-gray-900">
                  {{ NORMAL: 'Thường', URGENT: 'Khẩn', FLASH: 'Hỏa tốc' }[data.priority] ?? data.priority}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Cập nhật lần cuối</p>
                <p className="font-medium text-gray-900">
                  {formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true, locale: vi })}
                </p>
              </div>
              {data.slaDeadline && (
                <div className="col-span-2">
                  <p className="text-gray-500">Hạn xử lý</p>
                  <p
                    className={clsx(
                      'font-medium',
                      new Date(data.slaDeadline) < new Date() ? 'text-red-600' : 'text-gray-900',
                    )}
                  >
                    {format(new Date(data.slaDeadline), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
