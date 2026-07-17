import { ApiKeysManager } from './ApiKeysManager';
import { X } from 'lucide-react';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl flex flex-col h-[80vh] max-h-[800px] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 rounded-t-2xl shrink-0">
          <h2 className="text-lg font-semibold text-zinc-800 tracking-tight">API Key Management</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-500 hover:text-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-6 bg-zinc-50/30">
          <ApiKeysManager />
        </div>
      </div>
    </div>
  );
}
