import { useEffect, useState, useCallback } from 'react';
import { SystemCacheModal } from './SystemCacheModal';
import { SystemQueueModal } from './SystemQueueModal';
import { ApiQuotasModal } from './ApiQuotasModal';
import { ApiKeysModal } from './ApiKeysModal';
import { useAppStore } from '../store/app.store';
import { Plus, ChevronRight, Hash, Trash2, DatabaseZap, Clock, RefreshCw, Activity, KeySquare } from 'lucide-react';
import { api } from '../lib/api';

interface SystemStatus {
  cachedDataCount: number;
  pendingQueueCount: number;
}
export function Sidebar() {
  const { tenants, currentTenant, setTenants, setCurrentTenant } = useAppStore();
  const [newTenantName, setNewTenantName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCacheModalOpen, setIsCacheModalOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isQuotasModalOpen, setIsQuotasModalOpen] = useState(false);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/system/status');
      if (res.ok) {
        setSystemStatus(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    api.get('/tenants')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setTenants(data);
        if (data.length > 0 && !currentTenant) {
          setCurrentTenant(data[0]);
        }
      })
      .catch(console.error);
  }, [setTenants, currentTenant, setCurrentTenant]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim()) return;

    setIsCreating(true);
    try {
      const res = await api.post('/tenants', { name: newTenantName });
      const data = await res.json();
      setTenants([data, ...tenants]);
      setNewTenantName('');
      setCurrentTenant(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (tenantId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure? This will delete the tenant and ALL associated documents and chats.')) return;

    try {
      await api.delete(`/tenants/${tenantId}`);
      setTenants(tenants.filter(t => t.id !== tenantId));
      if (currentTenant?.id === tenantId) setCurrentTenant(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-64 bg-zinc-100 border-r border-zinc-200 flex flex-col h-full relative z-20">
      <div className="p-5 border-b border-zinc-200">
        <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight text-zinc-800">
          <img src="/logo.png" alt="NexusChat Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
          NexusChat
        </h1>
      </div>

      <div className="p-5">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">New Tenant</label>
          <div className="flex gap-2 relative">
            <input
              type="text"
              value={newTenantName}
              onChange={e => setNewTenantName(e.target.value)}
              placeholder="Company Name..."
              className="w-full bg-white border border-zinc-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-zinc-800 placeholder-zinc-400 shadow-sm"
            />
            <button
              disabled={isCreating || !newTenantName.trim()}
              className="absolute right-1 top-1 bottom-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 w-8 flex items-center justify-center rounded-md transition-all disabled:opacity-50 border border-indigo-200"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2 mb-3">Your Tenants</div>
        {tenants.map(tenant => (
          <div
            key={tenant.id}
            onClick={() => setCurrentTenant(tenant)}
            className={`w-full text-left px-3 py-2.5 mb-1 rounded-xl flex items-center justify-between group transition-all duration-300 border cursor-pointer ${currentTenant?.id === tenant.id
              ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
              : 'border-transparent text-zinc-600 hover:bg-white/60 hover:text-zinc-900'
              }`}
          >
            <div className="flex flex-col truncate pr-2">
              <span className="font-semibold text-sm truncate">{tenant.name}</span>
              <span className={`text-[10px] flex items-center gap-1 mt-0.5 font-medium tracking-wide ${currentTenant?.id === tenant.id ? 'text-zinc-500' : 'text-zinc-400'}`}>
                <Hash className="w-3 h-3 text-indigo-500" /> {tenant.code}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleDelete(tenant.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-100 text-rose-500 rounded transition-all"
                title="Delete Tenant"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {currentTenant?.id === tenant.id && (
                <ChevronRight className="w-4 h-4 text-indigo-500" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">System Status</div>
          <button
            onClick={fetchStatus}
            className="p-1 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setIsCacheModalOpen(true)}
            className="flex justify-between items-center bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-indigo-200 px-3 py-2 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 group-hover:text-indigo-700">
              <DatabaseZap className="w-3.5 h-3.5 text-indigo-500" />
              Cached Queries
            </div>
            <span className="text-xs font-bold text-zinc-800">{systemStatus?.cachedDataCount ?? '-'}</span>
          </button>

          <button
            onClick={() => setIsQueueModalOpen(true)}
            className="flex justify-between items-center bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-rose-200 px-3 py-2 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 group-hover:text-rose-700">
              <Clock className="w-3.5 h-3.5 text-rose-500" />
              Pending Docs
            </div>
            <span className="text-xs font-bold text-zinc-800">{systemStatus?.pendingQueueCount ?? '-'}</span>
          </button>

          <button
            onClick={() => setIsQuotasModalOpen(true)}
            className="flex justify-between items-center bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-emerald-200 px-3 py-2 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 group-hover:text-emerald-700">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              API Quotas
            </div>
            <span className="text-xs font-bold text-zinc-800">Limits</span>
          </button>
          <button
            onClick={() => setIsApiKeysModalOpen(true)}
            className="flex justify-between items-center bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-blue-200 px-3 py-2 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 group-hover:text-blue-700">
              <KeySquare className="w-3.5 h-3.5 text-blue-500" />
              API Keys
            </div>
            <span className="text-xs font-bold text-zinc-800">Manage</span>
          </button>
        </div>
      </div>

      <SystemCacheModal
        isOpen={isCacheModalOpen}
        onClose={() => setIsCacheModalOpen(false)}
        onUpdateCount={fetchStatus}
      />
      <SystemQueueModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        onUpdateCount={fetchStatus}
      />
      <ApiQuotasModal
        isOpen={isQuotasModalOpen}
        onClose={() => setIsQuotasModalOpen(false)}
      />
      <ApiKeysModal
        isOpen={isApiKeysModalOpen}
        onClose={() => setIsApiKeysModalOpen(false)}
      />
    </div>
  );
}
