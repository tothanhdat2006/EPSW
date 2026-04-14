import clsx from 'clsx';

const PRIORITY_STYLES: Record<string, string> = {
  NORMAL: 'bg-gray-100 text-gray-600',
  URGENT: 'bg-amber-100 text-amber-700',
  FLASH:  'bg-red-100 text-red-700 font-semibold',
};

const PRIORITY_LABELS: Record<string, string> = {
  NORMAL: 'Thường',
  URGENT: 'Khẩn',
  FLASH:  'Hỏa tốc',
};

export default function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs',
        PRIORITY_STYLES[priority] ?? 'bg-gray-100 text-gray-600',
      )}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}
