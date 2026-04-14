import clsx from 'clsx';

const STATUS_STYLES: Record<string, string> = {
  RECEIVED:    'bg-gray-100 text-gray-700',
  PROCESSING:  'bg-blue-100 text-blue-700',
  HITL_REVIEW: 'bg-orange-100 text-orange-700',
  VALIDATED:   'bg-yellow-100 text-yellow-700',
  REJECTED:    'bg-red-100 text-red-700',
  APPROVED:    'bg-green-100 text-green-700',
  PUBLISHED:   'bg-emerald-100 text-emerald-700',
};

const STATUS_LABELS: Record<string, string> = {
  RECEIVED:    'Đã nhận',
  PROCESSING:  'Đang xử lý',
  HITL_REVIEW: 'Chờ thủ công',
  VALIDATED:   'Hợp lệ',
  REJECTED:    'Từ chối',
  APPROVED:    'Phê duyệt',
  PUBLISHED:   'Đã phát hành',
};

interface Props {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600',
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
