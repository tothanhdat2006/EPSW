import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shield, Brain, Calendar, User, Building, ExternalLink, FileText, ImageIcon, Save, Sparkles, MessageSquare, AlertTriangle, Send, Loader2, RotateCw, X } from 'lucide-react';
import { documentsApi, aiApi } from '../api/client.ts';
import StatusBadge from '../components/StatusBadge.tsx';
import PriorityBadge from '../components/PriorityBadge.tsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ExtractedField {
  key: string;
  label: string;
  value: unknown;
  icon: React.ElementType;
}

function getProxiedUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.includes('localhost:9000')) {
    const path = url.split('localhost:9000')[1];
    return path;
  }
  return url;
}

function FileViewer({ url, title }: { url?: string; title: string }) {
  if (!url) {
    return (
      <div className="bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 h-full flex flex-col items-center justify-center p-12 text-gray-400">
        <FileText size={48} className="mb-4 opacity-20" />
        <p>Không có file đính kèm</p>
      </div>
    );
  }

  const isPdf = url.toLowerCase().endsWith('.pdf');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          {isPdf ? <FileText size={16} className="text-red-500" /> : <ImageIcon size={16} className="text-blue-500" />}
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
          title="Mở trong tab mới"
        >
          <ExternalLink size={16} />
        </a>
      </div>
      <div className="flex-1 bg-gray-800 flex items-center justify-center overflow-auto p-4">
        {isPdf ? (
          <iframe src={url} className="w-full h-full border-none bg-white rounded shadow-lg" />
        ) : (
          <img src={url} alt={title} className="max-w-full h-auto shadow-2xl rounded transition-transform hover:scale-105 duration-300" />
        )}
      </div>
    </div>
  );
}

export default function DocumentReview() {
  const { documentId } = useParams<{ documentId: string }>();
  const [editedData, setEditedData] = useState<Record<string, string>>({});
  const [showRedacted, setShowRedacted] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentsApi.get(documentId!).then((r) => r.data),
    enabled: !!documentId,
  });

  const reAnalyzeMutation = useMutation({
    mutationFn: () => aiApi.reAnalyze(documentId!, document?.trackingCode || '', (document as any)?.extractedData?.rawText || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      alert('Đã gửi yêu cầu tái phân tích AI!');
    },
  });

  const chatMutation = useMutation({
    mutationFn: (msg: string) => aiApi.chat(documentId!, msg, chatHistory),
    onSuccess: (data) => {
      setIsChatLoading(false);
      if (data.data.error) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: `Lỗi: ${data.data.error}` }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.data.response }]);
      }
    },
    onError: (error: any) => {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Lỗi: Không thể kết nối tới máy chủ AI. Vui lòng kiểm tra lại dịch vụ.' }]);
      setIsChatLoading(false);
    }
  });

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setIsChatLoading(true);
    chatMutation.mutate(msg);
  };

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

  const extracted = (document as any).extractedData ?? {};

  const fields: ExtractedField[] = [
    { key: 'documentType', label: 'Loại hồ sơ', value: extracted['documentType'], icon: Shield },
    { key: 'issuingAuthority', label: 'Cơ quan ban hành', value: extracted['issuingAuthority'], icon: Building },
    { key: 'issueDate', label: 'Ngày ban hành', value: extracted['issueDate'], icon: Calendar },
    { key: 'expiryDate', label: 'Ngày hết hạn', value: extracted['expiryDate'], icon: Calendar },
    { key: 'subjectName', label: 'Tên đối tượng', value: extracted['subjectName'], icon: User },
    { key: 'subjectId', label: 'Mã định danh', value: extracted['subjectId'], icon: User },
    { key: 'purpose', label: 'Mục đích', value: extracted['purpose'], icon: Brain },
  ];


  const currentFileUrl = getProxiedUrl(showRedacted ? document.redactedFileUrl : document.rawFileUrl);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="text-blue-500" size={20} /> Kiểm duyệt hồ sơ
            </h1>
            <p className="font-mono text-xs text-blue-700 mt-0.5">{document.trackingCode}</p>
          </div>
          <div className="h-8 w-px bg-gray-200 mx-1" />
          <div className="flex items-center gap-2">
            <PriorityBadge priority={document.priority} />
            <StatusBadge status={document.status} />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {document.redactedFileUrl && (
            <div className="bg-gray-100 p-1 rounded-lg flex border border-gray-200 mr-2">
              <button 
                onClick={() => setShowRedacted(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${!showRedacted ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Gốc
              </button>
              <button 
                onClick={() => setShowRedacted(true)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${showRedacted ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Đã che
              </button>
            </div>
          )}
          <button 
            disabled={Object.keys(editedData).length === 0}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
          >
            <Save size={16} />
            Lưu chỉnh sửa
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: Document Viewer */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <FileViewer url={currentFileUrl} title={showRedacted ? 'Bản đã che PII' : 'Bản gốc'} />
        </div>

        {/* Right: Insights Sidebar */}
        <aside className="w-[440px] border-l border-gray-200 bg-gray-50 overflow-y-auto p-6 space-y-6">
          {/* AI Insights Chat */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={14} /> Nhận định từ AI (Qwen)
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => reAnalyzeMutation.mutate()}
                  disabled={reAnalyzeMutation.isPending}
                  className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-500 transition-colors"
                  title="Tái phân tích hồ sơ"
                >
                  <RotateCw size={14} className={reAnalyzeMutation.isPending ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={() => setShowChat(!showChat)}
                  className={`p-1 hover:bg-gray-200 rounded transition-colors ${showChat ? 'text-blue-500 bg-blue-50 shadow-inner' : 'text-gray-400 hover:text-blue-500'}`}
                  title="Chat với AI"
                >
                  <MessageSquare size={14} />
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-1 opacity-10">
                <Brain size={40} className="text-blue-500" />
              </div>
              <div className="flex gap-3">
                <div className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                  <Brain size={16} className="text-white" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">
                    Chào Admin! Tôi đã phân tích hồ sơ này. Đây là một bản <strong>{extracted['documentType'] || 'Hồ sơ chưa xác định'}</strong>.
                  </p>
                  <p className="text-sm text-gray-600 italic">
                    {extracted['summary'] ? `"${extracted['summary']}"` : "Tôi đã tự động điền các trường thông tin trích xuất được bên dưới để bạn đối soát."}
                  </p>
                  <div className="pt-2 flex items-center gap-3">
                     <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${(document.aiConfidence ?? 0) >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Độ tin cậy: {(document.aiConfidence ?? 0).toFixed(1)}%
                     </span>
                     <span className="text-[10px] text-gray-400">Qwen-3.5-Plus</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Chat Drawer */}
            {showChat && (
              <div className="bg-white rounded-2xl border border-blue-200 shadow-xl flex flex-col h-[400px] overflow-hidden mt-4">
                <div className="p-3 bg-blue-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} />
                    <span className="text-xs font-bold">Qwen Assistant</span>
                  </div>
                  <button onClick={() => setShowChat(false)} className="hover:bg-blue-700 p-1 rounded transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {chatHistory.length === 0 && !isChatLoading && (
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-[13px] text-blue-800 leading-relaxed shadow-sm">
                      Chào bạn! Tôi sẵn sàng giải đáp các thắc mắc về nội dung hồ sơ này. Bạn cần tôi hỗ trợ gì?
                    </div>
                  )}
                  {chatHistory.map((chat, idx) => (
                    <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-[13px] shadow-sm leading-relaxed ${
                        chat.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : chat.content.startsWith('Lỗi:') || chat.content.includes('Xin lỗi')
                            ? 'bg-red-50 border border-red-100 text-red-700 rounded-tl-none'
                            : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
                      }`}>
                        {chat.content}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm">
                        <Loader2 size={16} className="text-blue-500 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-gray-100 bg-white">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex gap-2"
                  >
                    <input 
                      type="text" 
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Hỏi AI về hồ sơ..."
                      className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={isChatLoading || !chatMessage.trim()}
                      className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-90"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </section>

          {/* Extracted Data Form */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-5 border-b border-gray-100 pb-3">
              Dữ liệu trích xuất
            </h2>
            <div className="space-y-4">
              {fields.map(({ key, label, value, icon: Icon }) => {
                const isAutoFilled = value !== undefined && value !== null && value !== '';
                return (
                  <div key={key} className="group">
                    <label className="flex items-center justify-between gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Icon size={12} className="group-hover:text-blue-500 transition-colors" />
                        {label}
                      </span>
                      {isAutoFilled && (
                        <span className="flex items-center gap-0.5 text-[9px] text-green-500 lowercase opacity-0 group-hover:opacity-100 transition-opacity">
                          <Sparkles size={8} /> AI auto-filled
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        defaultValue={(value as string) ?? ''}
                        placeholder="..."
                        onChange={(e) =>
                          setEditedData((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none ${
                          isAutoFilled ? 'border-green-100' : 'border-gray-200'
                        }`}
                      />
                      {isAutoFilled && (
                         <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 opacity-30">
                           <Sparkles size={12} />
                         </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SLA & Security Footer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Bảo mật</p>
              <p className="text-xs font-semibold text-gray-800">{document.securityLevel}</p>
            </div>
            {document.slaDeadline && (
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Hạn SLA</p>
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-red-500" />
                  <p className="text-xs font-semibold text-gray-800">
                    {new Date(document.slaDeadline).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
