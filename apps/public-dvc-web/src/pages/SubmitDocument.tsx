import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import clsx from 'clsx';

type Priority = 'NORMAL' | 'URGENT' | 'FLASH';

interface SubmitResult {
  documentId: string;
  trackingCode: string;
  status: string;
  message: string;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; description: string }[] = [
  { value: 'NORMAL', label: 'Thường', description: 'Xử lý trong 48 giờ' },
  { value: 'URGENT', label: 'Khẩn', description: 'Xử lý trong 2 giờ' },
  { value: 'FLASH', label: 'Hỏa tốc', description: 'Xử lý ngay lập tức' },
];

const MAX_SIZE_MB = 50;

export default function SubmitDocument() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);

  const submitMutation = useMutation<SubmitResult, Error, FormData>({
    mutationFn: (formData) =>
      axios.post<SubmitResult>('/api/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
  });

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('priority', priority);
    submitMutation.mutate(formData);
  };

  const copyTracking = () => {
    if (submitMutation.data?.trackingCode) {
      navigator.clipboard.writeText(submitMutation.data.trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success state
  if (submitMutation.isSuccess && submitMutation.data) {
    const { trackingCode } = submitMutation.data;
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-10">
          <CheckCircle size={56} className="mx-auto text-green-500 mb-5" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Nộp hồ sơ thành công!</h2>
          <p className="text-gray-500 mb-6">
            Hệ thống đang xử lý hồ sơ của bạn. Lưu mã theo dõi bên dưới để tra cứu trạng thái.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between mb-6">
            <div className="text-left">
              <p className="text-xs text-gray-500 mb-1">Mã theo dõi</p>
              <p className="font-mono font-bold text-blue-700 text-lg">{trackingCode}</p>
            </div>
            <button
              onClick={copyTracking}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Copy size={16} />
              {copied ? 'Đã sao chép!' : 'Sao chép'}
            </button>
          </div>
          <button
            onClick={() => {
              submitMutation.reset();
              setFile(null);
              setPriority('NORMAL');
            }}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors"
          >
            Nộp hồ sơ khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nộp hồ sơ trực tuyến</h1>
        <p className="text-gray-500 mt-2">
          Tải lên tài liệu PDF hoặc hình ảnh scan. Hệ thống AI sẽ tự động xử lý.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 space-y-6">
        {/* File drop zone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Tài liệu hồ sơ <span className="text-red-500">*</span>
          </label>
          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : file
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50',
            )}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={28} className="text-green-500" />
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload size={36} className="mx-auto text-gray-400 mb-3" />
                <p className="font-medium text-gray-700">Kéo thả hoặc nhấp để chọn tệp</p>
                <p className="text-sm text-gray-400 mt-1">PDF, JPEG, PNG, TIFF — tối đa {MAX_SIZE_MB}MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {/* Priority selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Mức độ ưu tiên</label>
          <div className="grid grid-cols-3 gap-3">
            {PRIORITY_OPTIONS.map(({ value, label, description }) => (
              <label
                key={value}
                className={clsx(
                  'flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all text-center',
                  priority === value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <input
                  type="radio"
                  name="priority"
                  value={value}
                  checked={priority === value}
                  onChange={() => setPriority(value)}
                  className="sr-only"
                />
                <span className={clsx(
                  'font-bold text-sm',
                  priority === value ? 'text-blue-700' : 'text-gray-700',
                )}>
                  {label}
                </span>
                <span className="text-xs text-gray-400 mt-1">{description}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Error message */}
        {submitMutation.isError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Có lỗi xảy ra khi nộp hồ sơ. Vui lòng thử lại.
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!file || submitMutation.isPending}
          className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {submitMutation.isPending ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Đang nộp...
            </>
          ) : (
            <>
              <Upload size={16} />
              Nộp hồ sơ
            </>
          )}
        </button>
      </form>
    </div>
  );
}
