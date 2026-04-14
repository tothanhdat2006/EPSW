import { Routes, Route, Link, NavLink } from 'react-router-dom';
import { Upload, Search } from 'lucide-react';
import clsx from 'clsx';
import SubmitDocument from './pages/SubmitDocument.tsx';
import TrackDocument from './pages/TrackDocument.tsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">DVC</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">Cổng Dịch vụ Công</p>
              <p className="text-xs text-gray-500">Nộp và tra cứu hồ sơ trực tuyến</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            {[
              { to: '/', icon: Upload, label: 'Nộp hồ sơ' },
              { to: '/track', icon: Search, label: 'Tra cứu' },
            ].map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100',
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<SubmitDocument />} />
          <Route path="/track" element={<TrackDocument />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          Hệ thống DVC — Hỗ trợ: 1900-xxxx | Email: hotro@dvc.gov.vn
        </div>
      </footer>
    </div>
  );
}
