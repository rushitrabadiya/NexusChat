import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app.store';
import { api } from '../lib/api';
import { FileText, RotateCcw, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';

interface Document {
  id: string;
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error: string | null;
  createdAt: string;
}

export function DocumentList() {
  const currentTenant = useAppStore(state => state.currentTenant);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [, setRetryingId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const res = await api.get('/documents', {
        headers: { 'x-tenant-id': currentTenant.id }
      });
      const data = await res.json();
      setDocuments(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [currentTenant]);

  const handleRetry = async (docId: string) => {
    if (!currentTenant) return;
    setRetryingId(docId);
    try {
      await api.post(`/documents/${docId}/retry`, undefined, {
        headers: { 'x-tenant-id': currentTenant.id }
      });
      await fetchDocuments();
    } catch (error) {
      console.error(error);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!currentTenant) return;
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${docId}`, {
        headers: { 'x-tenant-id': currentTenant.id }
      });
      setDocuments(docs => docs.filter(d => d.id !== docId));
    } catch (error) {
      console.error(error);
    }
  };

  if (!currentTenant) return null;

  return (
    <div className="p-4 border-b border-zinc-200 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          Tenant Documents
        </h3>
        <button
          onClick={fetchDocuments}
          disabled={isLoading}
          className="text-xs text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {documents.length === 0 && !isLoading ? (
        <div className="text-center py-6 text-sm text-zinc-500">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex flex-col bg-white border border-zinc-200 p-3 rounded-xl group hover:-translate-y-0.5 hover:shadow-md hover:border-zinc-300 transition-all duration-300 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col overflow-hidden mr-3">
                  <span className="text-sm font-semibold truncate text-zinc-800">{doc.filename}</span>
                  <span className="text-[10px] text-zinc-500 font-medium tracking-wide mt-0.5 uppercase">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm
                      ${doc.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : ''}
                      ${doc.status === 'FAILED' ? 'bg-rose-100 text-rose-700 border border-rose-200' : ''}
                      ${(doc.status === 'PENDING' || doc.status === 'PROCESSING') ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : ''}
                    `}>
                    {doc.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {doc.status === 'FAILED' && <AlertCircle className="w-3.5 h-3.5" />}
                    {doc.status}
                  </span>

                  {doc.status === 'FAILED' && (
                    <button
                      onClick={() => handleRetry(doc.id)}
                      className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-all border border-zinc-200"
                      title="Retry processing"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-100 text-rose-600 transition-all border border-transparent hover:border-rose-200"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {doc.error && (
                <div className="mt-2 text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 break-words whitespace-pre-wrap">
                  <span className="font-semibold">Error:</span> {doc.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
