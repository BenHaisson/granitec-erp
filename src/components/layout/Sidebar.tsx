import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, BookOpen, Factory,
  ShoppingCart, Warehouse, ArrowLeftRight,
  BarChart3, Settings, LogOut,
} from 'lucide-react';
import { signOut } from '@/firebase/auth';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/bom', icon: BookOpen, label: 'BOM Recipes' },
  { to: '/production', icon: Factory, label: 'Production' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/warehouse', icon: Warehouse, label: 'Warehouse' },
  { to: '/movements', icon: ArrowLeftRight, label: 'Movements' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <aside className={`
      fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col shrink-0
      transition-transform duration-300 ease-in-out
      lg:static lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">Granitec ERP</h1>
        <p className="text-slate-400 text-xs mt-1">Factory Management</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
