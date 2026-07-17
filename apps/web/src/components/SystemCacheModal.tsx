import { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, RefreshCw, DatabaseZap } from 'lucide-react';
import { api } from '../lib/api';

interface CachedQuery {
  key: string;
  tenantId: string;
  queryText: string;
}

interface SystemCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateCount: () => void;
}

export function SystemCacheModal({ isOpen, onClose, onUpdateCount }: SystemCacheModalProps) {
  const [queries, setQueries] = useState<CachedQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchQueries();
    }
  }, [isOpen]);

  const fetchQueries = async () => {
    setLoading(true);
    try {
      const response = await api.get('/system/cache');
      const data = await response.json();
      setQueries(data);
    } catch (error) {
      console.error('Failed to fetch queries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (key: string) => {
    setDeletingKey(key);
    try {
      await api.post('/system/cache/delete', { key });
      setQueries(queries.filter(q => q.key !== key));
      onUpdateCount();
    } catch (error) {
      console.error('Failed to delete cache key:', error);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleFlush = async () => {
    if (!confirm('Are you sure you want to flush all cached queries? This will force AI to re-evaluate all future identical questions.')) return;
    
    setFlushing(true);
    try {
      await api.delete('/system/cache');
      setQueries([]);
      onUpdateCount();
    } catch (error) {
      console.error('Failed to flush cache:', error);
    } finally {
      setFlushing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden border border-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <DatabaseZap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-800">Cached Queries</h2>
              <p className="text-xs text-zinc-500 font-medium">Manage AI generated RAG responses</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFlush}
              disabled={queries.length === 0 || flushing}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md border border-rose-200 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {flushing ? 'Flushing...' : 'Flush Cache'}
            </button>
            <button
              onClick={fetchQueries}
              disabled={loading}
              className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/30">
          {loading && queries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : queries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-3">
              <DatabaseZap className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium">No cached queries found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queries.map((query) => (
                <div key={query.key} className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-lg shadow-sm hover:border-indigo-200 transition-colors group">
                  <div className="flex flex-col truncate pr-4">
                    <span className="text-sm font-semibold text-zinc-800 truncate" title={query.queryText}>
                      "{query.queryText}"
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 mt-1">
                      {query.key}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(query.key)}
                    disabled={deletingKey === query.key}
                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                    title="Delete Cache Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
