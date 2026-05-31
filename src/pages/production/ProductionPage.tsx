import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, PenLine, Layers, FileText, BookOpen,
} from 'lucide-react';
import ProductionDashboard  from './sub/ProductionDashboard';
import DailyPlanning        from './sub/DailyPlanning';
import DataEntry            from './sub/DataEntry';
import DiscStatusDashboard  from './sub/DiscStatusDashboard';
import DailyReport          from './sub/DailyReport';
import ProductionRecipes    from './sub/ProductionRecipes';

type Tab = 'dashboard' | 'planning' | 'data-entry' | 'disc-status' | 'report' | 'recipes';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'planning',    label: 'Daily Planning', icon: CalendarDays    },
  { id: 'data-entry',  label: 'Data Entry',    icon: PenLine          },
  { id: 'disc-status', label: 'Disc Status',   icon: Layers           },
  { id: 'report',      label: 'Daily Report',  icon: FileText         },
  { id: 'recipes',     label: 'Recipes',       icon: BookOpen         },
];

export default function ProductionPage() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => {
    const state = location.state as { tab?: string } | null;
    return (TABS.find(t => t.id === state?.tab)?.id ?? 'dashboard') as Tab;
  });

  // Clear the navigation state so a refresh doesn't re-trigger the tab switch
  useEffect(() => {
    if ((location.state as { tab?: string } | null)?.tab) {
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Production</h1>
        <p className="text-slate-500 text-sm mt-1">Manage daily targets, log batches, track disc pipeline</p>
      </div>

      {/* Sub-navigation */}
      <div className="flex overflow-x-auto gap-1 bg-slate-100 p-1 rounded-xl w-fit max-w-full">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === 'dashboard'   && <ProductionDashboard onNavigate={(t) => setTab(t as Tab)} />}
        {tab === 'planning'    && <DailyPlanning />}
        {tab === 'data-entry'  && <DataEntry />}
        {tab === 'disc-status' && <DiscStatusDashboard />}
        {tab === 'report'      && <DailyReport />}
        {tab === 'recipes'     && <ProductionRecipes />}
      </div>
    </div>
  );
}
