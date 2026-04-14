import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { FileText, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { documentsApi, type DocumentSummary } from '../api/client.ts';
import StatusBadge from '../components/StatusBadge.tsx';
import PriorityBadge from '../components/PriorityBadge.tsx';

const STATUS_FILTERS = ['ALL', 'RECEIVED', 'PROCESSING', 'HITL_REVIEW', 'VALIDATED', 'APPROVED', 'REJECTED'];

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['documents', statusFilter],
    queryFn: () =>
      documentsApi
        .list({ status: statusFilter === 'ALL' ? undefined : statusFilter })
        .then((r) => r.data),
  });

  const documents: DocumentSummary[] = data?.documents ?? [];
  const total = data?.total ?? 0;

  const stats = {
    total,
    hitlPending: documents.filter((d) => d.status === 'HITL_REVIEW').length,
    slaBreaching: documents.filter((d) => d.slaDeadline && new Date(d.slaDeadline) < new Date()).length,
    approved: documents.filter((d) => d.status === 'APPROVED' || d.status === 'PUBLISHED').length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Tổng quan hồ sơ trong hệ thống</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng hồ sơ" value={stats.total} icon={FileText} color="bg-blue-500" />
        <StatCard label="Chờ xử lý thủ công" value={stats.hitlPending} icon={AlertTriangle} color="bg-orange-500" />
        <StatCard label="Quá hạn SLA" value={stats.slaBreaching} icon={Clock} color="bg-red-500" />
        <StatCard label="Đã phê duyệt" value={stats.approved} icon={CheckCircle} color="bg-green-500" />
      </div>

      {/* Filter tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'ALL' ? 'Tất cả' : s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Mã hồ sơ</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Trạng thái</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Ưu tiên</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">AI Score</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Hạn SLA</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Thời gian</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Không có hồ sơ nào
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-blue-700">
                      {doc.trackingCode}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-6 py-4">
                      <PriorityBadge priority={doc.priority} />
                    </td>
                    <td className="px-6 py-4">
                      {doc.aiConfidence !== undefined ? (
                        <span
                          className={`font-medium ${
                            doc.aiConfidence >= 70 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {doc.aiConfidence.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {doc.slaDeadline ? (
                        <span
                          className={
                            new Date(doc.slaDeadline) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600'
                          }
                        >
                          {formatDistanceToNow(new Date(doc.slaDeadline), { addSuffix: true, locale: vi })}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true, locale: vi })}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/review/${doc.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
