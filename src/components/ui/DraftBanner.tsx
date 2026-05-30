import { FileEdit, RotateCcw } from 'lucide-react';

interface Props {
  savedAt: string | null;
  onContinue: () => void;
  onDiscard: () => void;
}

function formatSavedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `today at ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
  } catch {
    return 'previously';
  }
}

export default function DraftBanner({ savedAt, onContinue, onDiscard }: Props) {
  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
      <FileEdit size={16} className="text-indigo-500 shrink-0" />
      <p className="flex-1 text-sm text-indigo-800">
        You have unsaved work from <strong>{savedAt ? formatSavedAt(savedAt) : 'a previous session'}</strong>.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onContinue}
          className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          Continue
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <RotateCcw size={11} /> Fresh start
        </button>
      </div>
    </div>
  );
}
