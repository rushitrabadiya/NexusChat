import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle, RotateCcw, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../store/app.store';
import { api, API_URL } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  modelUsed?: string;
  isError?: boolean;
  isRateLimit?: boolean;
  sources?: string[];
}

const formatSourceName = (filename: string) => {
  return filename
    .replace(/\.[^/.]+$/, "") // remove extension
    .replace(/[-_]/g, " ") // replace dashes and underscores
    .replace(/\b\w/g, c => c.toUpperCase()) // title case
    .trim();
};

export function Chat() {
  const { currentTenant, chatSessionId, setChatSessionId } = useAppStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!chatSessionId || !currentTenant) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await api.get(`/chat/${chatSessionId}/messages`, {
          headers: { 'x-tenant-id': currentTenant.id }
        });
        const data = await res.json();
        setMessages(data.map((msg: any) => ({
          id: msg.id,
          role: msg.role === 'USER' ? 'user' : 'model',
          content: msg.content,
          modelUsed: msg.modelUsed,
          sources: msg.sources || []
        })));
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();
  }, [chatSessionId, currentTenant]);

  const submitMessage = async (text: string) => {
    setIsStreaming(true);

    const modelMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMessageId, role: 'model', content: '' }]);

    try {
      const res = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': currentTenant!.id
        },
        body: JSON.stringify({ message: text, chatSessionId }),
      });

      if (!res.body) throw new Error('No readable stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      let currentModel = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.type === 'session' && data.sessionId) {
                  setChatSessionId(data.sessionId);
                } else if (data.type === 'model') {
                  currentModel = data.model;
                  setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, modelUsed: currentModel } : m));
                } else if (data.type === 'sources') {
                  setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, sources: data.sources } : m));
                } else if (data.type === 'chunk') {
                  setMessages(prev => prev.map(m =>
                    m.id === modelMessageId ? { ...m, content: m.content + data.text } : m
                  ));
                } else if (data.type === 'error') {
                  setMessages(prev => prev.map(m =>
                    m.id === modelMessageId ? { ...m, content: data.message, isError: true, isRateLimit: data.isRateLimit } : m
                  ));
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", dataStr);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(m =>
        m.id === modelMessageId ? { ...m, content: 'Network error occurred. Please try again.', isError: true } : m
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentTenant) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const textToSubmit = input;
    setInput('');

    await submitMessage(textToSubmit);
  };

  const handleRetry = (msgIndex: number) => {
    const userMsg = messages[msgIndex - 1];
    if (userMsg && userMsg.role === 'user') {
      setMessages(prev => prev.filter((_, i) => i !== msgIndex));
      submitMessage(userMsg.content);
    }
  };

  if (!currentTenant) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <Sparkles className="w-12 h-12 mb-4 text-zinc-700" />
        <h2 className="text-xl font-medium text-zinc-400">Select a Workspace</h2>
        <p className="text-sm mt-2">Choose or create a tenant from the sidebar to begin.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400">
            <div className="p-4 bg-zinc-50 rounded-full border border-zinc-200 mb-4 shadow-sm">
              <Bot className="w-8 h-8 text-indigo-500" />
            </div>
            <p>Ask anything based on your documents...</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm
                  ${msg.isError ? 'bg-rose-50 border border-rose-200' : 'bg-white border border-zinc-200'}`}>
                  {msg.isError ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <Bot className="w-4 h-4 text-indigo-500" />}
                </div>
              )}
              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-3.5 rounded-2xl max-w-prose shadow-sm ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : msg.isError
                    ? 'bg-rose-50 border border-rose-200 text-rose-800 rounded-tl-sm'
                    : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm'
                  }`}>

                  {msg.isError && (
                    <div className="flex items-center gap-2 mb-2 text-rose-400 font-medium text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{msg.isRateLimit ? 'Rate Limit Exceeded' : 'Error'}</span>
                    </div>
                  )}

                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className={`prose prose-sm max-w-none ${msg.isError ? 'prose-rose text-rose-800' : 'text-zinc-800'}`}>
                      {msg.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        isStreaming && !msg.isError && <p>Thinking...</p>
                      )}
                    </div>
                  )}

                  {msg.isError && (
                    <button
                      onClick={() => handleRetry(index)}
                      disabled={isStreaming}
                      className="mt-3 flex items-center gap-2 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3 h-3 ${isStreaming ? 'animate-spin' : ''}`} />
                      Retry Message
                    </button>
                  )}
                </div>

                {msg.sources && msg.sources.length > 0 && !msg.isError && (
                  <div className="mt-3 flex flex-wrap gap-2 px-1">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest flex items-center h-6">Sources:</span>
                    {msg.sources.map((source, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-medium shadow-sm transition-all hover:bg-zinc-200 cursor-default" title={source}>
                        <FileText className="w-3 h-3 text-indigo-400" />
                        {formatSourceName(source)}
                      </span>
                    ))}
                  </div>
                )}

                {msg.modelUsed && !msg.isError && (
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider mt-2 px-1 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3 h-3 text-indigo-400" /> {msg.modelUsed}
                  </span>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-32" />
      </div>

      <div className="absolute bottom-6 left-0 right-0 px-4 pointer-events-none">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center pointer-events-auto">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="Message Antigravity RAG..."
            className="w-full bg-white/90 backdrop-blur-xl border border-zinc-200 rounded-2xl pl-5 pr-14 py-4 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 text-zinc-900 placeholder-zinc-400 shadow-xl"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-all disabled:opacity-30 disabled:bg-zinc-400 shadow-sm"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <div className="text-center mt-3 pointer-events-auto">
          <span className="text-[10px] text-zinc-500 font-medium tracking-wide">AI can make mistakes. Verify important information.</span>
        </div>
      </div>
    </div>
  );
}
