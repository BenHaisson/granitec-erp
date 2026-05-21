import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Factory,
  ShoppingCart, Warehouse, ArrowLeftRight,
  BarChart3, Settings, LogOut, TrendingUp,
} from 'lucide-react';
import { signOut } from '@/firebase/auth';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/inventory', icon: Package, label: 'Inventory' },
      { to: '/warehouse', icon: Warehouse, label: 'Warehouse' },
      { to: '/production', icon: Factory, label: 'Production' },
      { to: '/sales', icon: ShoppingCart, label: 'Sales' },
      { to: '/movements', icon: ArrowLeftRight, label: 'Movements' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Reports' },
      { to: '/analytics', icon: TrendingUp, label: 'Supply Analytics' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <aside className={`
      fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white flex flex-col shrink-0
      transition-transform duration-300 ease-in-out
      lg:static lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25">
            <Factory size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Granitec ERP</h1>
            <p className="text-slate-400 text-[11px]">Factory Management</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="mb-5">
            <p className="px-5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {section.label}
            </p>
            <div className="space-y-0.5 px-3">
              {section.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all border-l-2 ${
                      isActive
                        ? 'bg-white/10 text-white font-medium border-blue-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent'
                    }`
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-slate-800/60">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all border-l-2 border-transparent"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
