import { Bell, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 lg:px-6 py-4 flex items-center justify-between shrink-0">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-slate-100 transition-colors lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu size={20} className="text-slate-600" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors group">
          <Bell size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-md shadow-blue-500/20">
            {user?.email?.[0].toUpperCase() ?? 'U'}
          </div>
          <span className="text-sm text-slate-600 hidden sm:block">{user?.email}</span>
        </div>
      </div>
    </header>
  );
}
