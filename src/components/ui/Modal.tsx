import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export default function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
