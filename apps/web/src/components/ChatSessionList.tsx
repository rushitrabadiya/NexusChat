import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app.store';
import { api } from '../lib/api';
import { MessageSquare, Plus, Clock } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string | null;
  updatedAt: string;
}

export function ChatSessionList() {
  const { currentTenant, chatSessionId, setChatSessionId } = useAppStore();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch sessions when tenant changes or when a new session is created (chatSessionId changes)
  useEffect(() => {
    if (!currentTenant) return;

    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/chat', {
          headers: { 'x-tenant-id': currentTenant.id }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSessions(data);
      } catch (error) {
        console.error('Failed to fetch chat sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSessions();
  }, [currentTenant, chatSessionId]);



  // Reset chat when tenant changes
  useEffect(() => {
    setChatSessionId(null);
  }, [currentTenant?.id, setChatSessionId]);

  if (!currentTenant) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-50">
      <div className="p-5 flex items-center justify-between border-b border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2 tracking-tight">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          Chat History
        </h3>
        <button
          onClick={() => setChatSessionId(null)}
          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg transition-all shadow-sm"
          title="New Chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading && sessions.length === 0 ? (
          <div className="text-center py-6 text-sm text-zinc-500 font-medium">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-6 text-sm text-zinc-500 font-medium">
            No chat history yet.
          </div>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setChatSessionId(session.id)}
              className={`w-full flex flex-col text-left px-3.5 py-2.5 rounded-xl transition-all duration-300 border ${chatSessionId === session.id
                ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                : 'bg-transparent border-transparent hover:bg-white hover:border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:shadow-sm'
                }`}
            >
              <span className="text-sm font-semibold truncate w-full tracking-tight">
                {session.title || 'New Conversation'}
              </span>
              <span className={`text-[10px] flex items-center gap-1.5 mt-1 font-medium ${chatSessionId === session.id ? 'text-indigo-500' : 'text-zinc-500'
                }`}>
                <Clock className="w-3 h-3" />
                {new Date(session.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
