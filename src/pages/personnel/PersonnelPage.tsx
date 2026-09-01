import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, CalendarOff, CalendarDays, Clock, Wallet, CalendarRange } from 'lucide-react';
import EmployeeDirectory from './sub/EmployeeDirectory';
import Absences         from './sub/Absences';
import Leave            from './sub/Leave';
import Overtime         from './sub/Overtime';
import Advances         from './sub/Advances';
import MonthlySummary   from './sub/MonthlySummary';

type Tab = 'directory' | 'absences' | 'leave' | 'overtime' | 'advances' | 'monthly';

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'directory', label: 'Directory', icon: Users         },
  { id: 'absences',  label: 'Absences',  icon: CalendarOff   },
  { id: 'leave',     label: 'Leave',     icon: CalendarDays  },
  { id: 'overtime',  label: 'Overtime',  icon: Clock         },
  { id: 'advances',  label: 'Advances',  icon: Wallet        },
  { id: 'monthly',   label: 'Monthly',   icon: CalendarRange },
];

interface NavigationState { tab?: string }

export default function PersonnelPage() {
  const location = useLocation();
  const state = location.state as NavigationState | null;
  const [tab, setTab] = useState<Tab>(() =>
    (TABS.find(t => t.id === state?.tab)?.id ?? 'directory') as Tab
  );

  // Clear the navigation state so a refresh doesn't re-trigger the tab switch
  useEffect(() => {
    if (state?.tab) window.history.replaceState({}, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Personnel</h1>
        <p className="text-slate-500 text-sm mt-1">Staff records, absences, leave, overtime and salary advances</p>
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
        {tab === 'directory' && <EmployeeDirectory />}
        {tab === 'absences'  && <Absences />}
        {tab === 'leave'     && <Leave />}
        {tab === 'overtime'  && <Overtime />}
        {tab === 'advances'  && <Advances />}
        {tab === 'monthly'   && <MonthlySummary />}
      </div>
    </div>
  );
}
