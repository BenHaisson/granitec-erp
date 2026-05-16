import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <Bell size={18} className="text-slate-500" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
            {user?.email?.[0].toUpperCase() ?? 'U'}
          </div>
          <span className="text-sm text-slate-600">{user?.email}</span>
        </div>
      </div>
    </header>
  );
}
