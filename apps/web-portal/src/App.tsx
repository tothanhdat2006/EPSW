import { Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, FileSearch, CheckCircle } from 'lucide-react';
import Dashboard from './pages/Dashboard.tsx';
import HITLTaskQueue from './pages/HITLTaskQueue.tsx';
import DocumentReview from './pages/DocumentReview.tsx';
import ApprovalView from './pages/ApprovalView.tsx';
import clsx from 'clsx';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/hitl', icon: ClipboardList, label: 'Hàng đợi HITL' },
  { to: '/review', icon: FileSearch, label: 'Kiểm duyệt hồ sơ' },
  { to: '/approval', icon: CheckCircle, label: 'Phê duyệt Lãnh đạo' },
];

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col shadow-xl">
        <div className="px-6 py-5 border-b border-blue-800">
          <h1 className="text-lg font-bold leading-tight">Hệ thống DVC</h1>
          <p className="text-xs text-blue-300 mt-0.5">Cổng tác nghiệp nội bộ</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-blue-800 text-xs text-blue-400">
          v1.0.0 — DVC Workflow System
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/hitl" element={<HITLTaskQueue />} />
          <Route path="/review/:documentId?" element={<DocumentReview />} />
          <Route path="/approval" element={<ApprovalView />} />
        </Routes>
      </main>
    </div>
  );
}
