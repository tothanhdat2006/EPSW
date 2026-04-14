import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { UserCheck, AlertCircle } from 'lucide-react';
import { hitlApi, type HitlTask } from '../api/client.ts';
import PriorityBadge from '../components/PriorityBadge.tsx';

const TASK_TYPE_LABELS: Record<string, string> = {
  OCR_FIX: 'Sửa lỗi OCR',
  AI_REVIEW: 'Kiểm tra AI',
  MANAGER_ESCALATION: 'Leo thang Quản lý',
  PRINT_ISSUE: 'Lỗi in ấn',
};

const ROLE_LABELS: Record<string, string> = {
  VAN_THU: 'Văn thư',
  CHUYEN_VIEN: 'Chuyên viên',
  QUAN_LY: 'Quản lý',
  LANH_DAO: 'Lãnh đạo',
  THU_KY: 'Thư ký',
};

export default function HITLTaskQueue() {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<HitlTask | null>(null);
  const [resolution, setResolution] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['hitl-tasks'],
    queryFn: () => hitlApi.listTasks().then((r) => r.data),
    refetchInterval: 10_000,
  });

  const claimMutation = useMutation({
    mutationFn: (taskId: string) => hitlApi.claimTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hitl-tasks'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Record<string, unknown> }) =>
      hitlApi.resolveTask(taskId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hitl-tasks'] });
      setSelectedTask(null);
      setResolution('');
    },
  });

  const tasks: HitlTask[] = data?.tasks ?? [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Hàng đợi HITL</h1>
        <p className="text-gray-500 mt-1">
          Các tác vụ cần xử lý thủ công — {tasks.length} tác vụ đang chờ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task list */}
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-gray-400 text-center py-12">Đang tải...</p>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Không có tác vụ nào đang chờ xử lý</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedTask?.id === task.id
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-semibold text-blue-700 truncate">
                      {task.document?.trackingCode ?? task.documentId}
                    </p>
                    <p className="font-medium text-gray-900 mt-1">
                      {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Vai trò: {ROLE_LABELS[task.assignedRole] ?? task.assignedRole}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {task.document?.priority && (
                      <PriorityBadge priority={task.document.priority} />
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        task.status === 'PENDING'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {task.status === 'PENDING' ? 'Chờ nhận' : 'Đang xử lý'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: vi })}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Task detail / resolution panel */}
        {selectedTask ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {TASK_TYPE_LABELS[selectedTask.taskType] ?? selectedTask.taskType}
            </h2>
            <p className="font-mono text-xs text-blue-700 mb-4">
              {selectedTask.documentId}
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Trạng thái</span>
                <span className="font-medium">{selectedTask.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Vai trò xử lý</span>
                <span className="font-medium">
                  {ROLE_LABELS[selectedTask.assignedRole] ?? selectedTask.assignedRole}
                </span>
              </div>
              {selectedTask.document?.slaDeadline && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Hạn SLA</span>
                  <span className="font-medium text-red-600">
                    {formatDistanceToNow(new Date(selectedTask.document.slaDeadline), {
                      addSuffix: true,
                      locale: vi,
                    })}
                  </span>
                </div>
              )}
            </div>

            {selectedTask.status === 'PENDING' && (
              <button
                onClick={() => claimMutation.mutate(selectedTask.id)}
                disabled={claimMutation.isPending}
                className="w-full mb-4 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <UserCheck size={16} />
                Nhận tác vụ
              </button>
            )}

            {selectedTask.status === 'IN_PROGRESS' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kết quả xử lý
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Nhập kết quả xử lý thủ công..."
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <button
                  onClick={() =>
                    resolveMutation.mutate({
                      taskId: selectedTask.id,
                      data: { manualResolution: resolution, resolvedAt: new Date().toISOString() },
                    })
                  }
                  disabled={!resolution.trim() || resolveMutation.isPending}
                  className="w-full mt-3 bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Hoàn thành tác vụ
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Chọn một tác vụ để xem chi tiết</p>
          </div>
        )}
      </div>
    </div>
  );
}
