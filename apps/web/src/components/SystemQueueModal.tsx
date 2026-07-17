import { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { api } from '../lib/api';

interface QueueJob {
  id: string;
  name: string;
  status: string;
  failedReason?: string;
  data: any;
}

interface SystemQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateCount: () => void;
}

export function SystemQueueModal({ isOpen, onClose, onUpdateCount }: SystemQueueModalProps) {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchJobs();
    }
  }, [isOpen]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/system/queue');
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/system/queue/${id}`);
      setJobs(jobs.filter(j => j.id !== id));
      onUpdateCount();
    } catch (error) {
      console.error('Failed to delete queue job:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleFlush = async () => {
    if (!confirm('Are you sure you want to completely clear the document queue? Any pending documents will not be processed.')) return;
    
    setFlushing(true);
    try {
      await api.delete('/system/queue');
      setJobs([]);
      onUpdateCount();
    } catch (error) {
      console.error('Failed to clear queue:', error);
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
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-800">Pending Docs Queue</h2>
              <p className="text-xs text-zinc-500 font-medium">Manage background document embedding jobs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFlush}
              disabled={jobs.length === 0 || flushing}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md border border-rose-200 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {flushing ? 'Clearing...' : 'Clear Queue'}
            </button>
            <button
              onClick={fetchJobs}
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
          {loading && jobs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-3">
              <Clock className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium">No pending documents in queue</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-lg shadow-sm hover:border-indigo-200 transition-colors group">
                  <div className="flex flex-col truncate pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-800 truncate" title={job.data?.filename || 'Unknown Document'}>
                        {job.data?.filename || 'Unknown Document'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        job.status === 'failed' ? 'bg-rose-100 text-rose-600' :
                        job.status === 'active' ? 'bg-indigo-100 text-indigo-600' :
                        job.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    {job.failedReason ? (
                      <span className="text-[10px] text-rose-500 mt-1 truncate">
                        Error: {job.failedReason}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-400 mt-1">
                        Job ID: {job.id} | Size: {job.data?.fileSize ? Math.round(job.data.fileSize / 1024) + ' KB' : 'Unknown'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                    title="Delete Job"
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
