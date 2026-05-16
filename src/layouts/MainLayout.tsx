import { ReactNode } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
