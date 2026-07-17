import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, KeyRound, Activity, Settings2, Save } from 'lucide-react';

interface ApiKey {
  id: string;
  provider: string;
  name: string;
  key: string;
  isActive: boolean;
  limitRequestsMin: number | null;
  limitRequestsDay: number | null;
  limitTokensMin: number | null;
  limitTokensDay: number | null;
  usageRequests: number;
  usageTokens: number;
  createdAt: string;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // New Key Form State
  const [provider, setProvider] = useState('GEMINI');
  const [name, setName] = useState('GEMINI_API_KEY_1');
  const [keyString, setKeyString] = useState('');
  const [limits, setLimits] = useState({
    reqMin: '',
    reqDay: '',
    tokMin: '',
    tokDay: ''
  });

  const fetchKeys = async () => {
    try {
      const res = await api.get('/system/apikeys');
      if (res.ok) setKeys(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation to prevent negative numbers
    const reqMin = limits.reqMin ? parseInt(limits.reqMin) : null;
    const reqDay = limits.reqDay ? parseInt(limits.reqDay) : null;
    const tokMin = limits.tokMin ? parseInt(limits.tokMin) : null;
    const tokDay = limits.tokDay ? parseInt(limits.tokDay) : null;

    if (
      (reqMin !== null && reqMin < 0) ||
      (reqDay !== null && reqDay < 0) ||
      (tokMin !== null && tokMin < 0) ||
      (tokDay !== null && tokDay < 0)
    ) {
      alert("Rate limits cannot be negative.");
      return;
    }

    try {
      const payload = {
        provider,
        name,
        key: keyString,
        limitRequestsMin: reqMin,
        limitRequestsDay: reqDay,
        limitTokensMin: tokMin,
        limitTokensDay: tokDay,
      };
      const res = await api.post('/system/apikeys', payload);
      if (res.ok) {
        setIsAdding(false);
        setKeyString('');
        setLimits({ reqMin: '', reqDay: '', tokMin: '', tokDay: '' });
        fetchKeys();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      await api.delete(`/system/apikeys/${id}`);
      fetchKeys();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.patch(`/system/apikeys/${id}/toggle`, { isActive: !current });
      fetchKeys();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50/50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">API Key Configuration</h3>
          <p className="text-xs text-slate-400 mt-1">Manage providers, rate limits, and view permanent token usage.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add API Key
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-500" /> Register New Key
          </h4>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Provider</label>
              <select
                value={provider}
                onChange={e => {
                  setProvider(e.target.value);
                  setName(`${e.target.value}_API_KEY_${keys.filter(k => k.provider === e.target.value).length + 1}`);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="GEMINI">Google Gemini</option>
                <option value="OPENROUTER">OpenRouter</option>
                <option value="GROQ">Groq</option>
                <option value="COHERE">Cohere</option>
                <option value="JINA">Jina AI</option>
                <option value="HUGGINGFACE">HuggingFace</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Name Identifier</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="GEMINI_API_KEY_1"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">API Key</label>
              <input
                type="password"
                required
                value={keyString}
                onChange={e => setKeyString(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
            <h5 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-slate-400" /> Rate Limits (Optional)</h5>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Req / Minute</label>
                <input type="number" min="0" value={limits.reqMin} onChange={e => setLimits({ ...limits, reqMin: e.target.value })} placeholder="Unlimited" className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Req / Day</label>
                <input type="number" min="0" value={limits.reqDay} onChange={e => setLimits({ ...limits, reqDay: e.target.value })} placeholder="Unlimited" className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tokens / Minute</label>
                <input type="number" min="0" value={limits.tokMin} onChange={e => setLimits({ ...limits, tokMin: e.target.value })} placeholder="Unlimited" className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tokens / Day</label>
                <input type="number" min="0" value={limits.tokDay} onChange={e => setLimits({ ...limits, tokDay: e.target.value })} placeholder="Unlimited" className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
            <button type="submit" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <Save className="w-4 h-4" /> Save Key
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {keys.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
            <Settings2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No API Keys configured.</p>
            <p className="text-xs text-slate-400 mt-1">Add a key to enable AI features.</p>
          </div>
        )}

        {keys.map(key => (
          <div key={key.id} className={`bg-white p-4 rounded-xl border ${key.isActive ? 'border-slate-200' : 'border-rose-100 bg-rose-50/30'} shadow-sm flex items-center justify-between transition-all hover:border-indigo-200`}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <KeyRound className={`w-5 h-5 ${key.isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{key.name}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${key.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {key.isActive ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
                <div className="flex gap-4 text-[11px] text-slate-500">
                  <span className="font-medium text-indigo-600">{key.provider}</span>
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{key.key ? '••••••••' : '••••••••'}</span>
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-emerald-500" /> {key.usageRequests.toLocaleString()} Reqs</span>
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-amber-500" /> {key.usageTokens.toLocaleString()} Tokens</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right mr-4 hidden md:block">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Limits Configured</div>
                <div className="text-xs text-slate-600">
                  {key.limitRequestsMin ? `${key.limitRequestsMin} RPM` : 'No RPM'} • {key.limitRequestsDay ? `${key.limitRequestsDay} RPD` : 'No RPD'}
                </div>
              </div>
              <button
                onClick={() => toggleActive(key.id, key.isActive)}
                className="text-xs font-medium px-3 py-1.5 rounded border transition-colors hover:bg-slate-50"
              >
                {key.isActive ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => handleDelete(key.id)}
                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Delete Key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
