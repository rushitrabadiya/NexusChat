import { ApiQuotasPanel } from './ApiQuotasPanel';
import { X } from 'lucide-react';

interface ApiQuotasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiQuotasModal({ isOpen, onClose }: ApiQuotasModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col h-[70vh] max-h-[600px] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 rounded-t-2xl shrink-0">
          <h2 className="text-lg font-semibold text-zinc-800 tracking-tight">API Quotas & Rate Limits</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-500 hover:text-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-6 bg-zinc-50/30">
          <ApiQuotasPanel />
        </div>
      </div>
    </div>
  );
}
