import { useEffect, useState } from 'react';
import { RefreshCcw, KeyRound } from 'lucide-react';
import { api } from '../lib/api';

interface QuotaStatus {
  key: string;
  provider: string;
  limitType: string;
  requestsRemaining: number;
  requestsLimit: number;
  resetsInSeconds: number;
}

export function ApiQuotasPanel() {
  const [quotas, setQuotas] = useState<QuotaStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchQuotas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/quotas');
      if (res.ok) {
        const data = await res.json();
        setQuotas(data);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch API Quotas', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotas();
    const interval = setInterval(fetchQuotas, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  // Local countdown timer for smooth UI ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setQuotas(currentQuotas =>
        currentQuotas.map(q => ({
          ...q,
          resetsInSeconds: Math.max(0, q.resetsInSeconds - 1)
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getProgressColor = (remaining: number, limit: number) => {
    if (limit >= 999999) return 'bg-emerald-500'; // Unlimited
    const percentage = (remaining / limit) * 100;
    if (percentage > 50) return 'bg-emerald-500';
    if (percentage > 20) return 'bg-amber-400';
    return 'bg-rose-500';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 px-2">
        <span className="text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</span>
        <button
          onClick={fetchQuotas}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded transition-colors border border-indigo-100"
        >
          <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {quotas.length === 0 && !loading && (
          <div className="text-center py-6 text-slate-500 text-sm">No API Keys tracked yet.</div>
        )}

        {Array.from(new Set(quotas.map(q => q.provider))).map(provider => {
          const providerQuotas = quotas.filter(q => q.provider === provider);

          return (
            <div key={provider} className="mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 pl-1 border-l-2 border-slate-300">
                {provider}
              </h3>

              <div className="flex flex-col gap-1.5">
                {providerQuotas.map((quota, idx) => {
                  const percentage = Math.max(0, quota.requestsRemaining / quota.requestsLimit) * 100;
                  return (
                    <div key={`${quota.provider}-${idx}`} className="flex items-center justify-between text-sm bg-white border border-slate-200 shadow-sm rounded-md px-3 py-2 hover:border-indigo-200 transition-colors">

                      {/* Key Name */}
                      <div className="flex items-center gap-1.5 min-w-[70px]">
                        <KeyRound className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-700 font-semibold text-[11px] max-w-[100px] truncate" title={quota.key}>{quota.key}</span>
                      </div>

                      {/* Progress Bar & Numbers */}
                      <div className="flex-1 mx-3 flex flex-col justify-center">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[9px] text-slate-400 font-medium">USAGE</span>
                          <span className={`text-[10px] font-bold ${quota.requestsRemaining <= 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                            {quota.requestsRemaining >= 999999 ? '∞' : quota.requestsRemaining}<span className="font-normal text-slate-400">/{quota.requestsLimit >= 999999 ? '∞' : quota.requestsLimit}</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                          <div
                            className={`h-full transition-all duration-500 ${getProgressColor(quota.requestsRemaining, quota.requestsLimit)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Reset Timer */}
                      <div className="w-[60px] text-right flex flex-col justify-center">
                        {quota.requestsLimit >= 999999 ? (
                          <>
                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Status</span>
                            <span className="text-[11px] text-emerald-500 font-bold tracking-wide">NO LIMIT</span>
                          </>
                        ) : quota.resetsInSeconds > 0 ? (
                          <>
                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{quota.limitType}</span>
                            <span className="text-[11px] text-indigo-600 font-bold">{formatTime(quota.resetsInSeconds)}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Status</span>
                            <span className="text-[11px] text-emerald-500 font-bold tracking-wide">READY</span>
                          </>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
