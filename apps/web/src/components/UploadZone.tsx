import { useCallback, useState } from 'react';
import { UploadCloud, Loader2, CheckCircle2, Globe, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/app.store';
import { api } from '../lib/api';

export function UploadZone() {
  const currentTenant = useAppStore(state => state.currentTenant);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlStatus, setCrawlStatus] = useState<'idle' | 'crawling' | 'success'>('idle');

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!currentTenant) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    await uploadFiles(files);
  }, [currentTenant]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentTenant || !e.target.files) return;
    await uploadFiles(Array.from(e.target.files));
  };

  const uploadFiles = async (files: File[]) => {
    setStatus('uploading');

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'x-tenant-id': currentTenant!.id },
      });
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('idle');
    }
  };

  const handleCrawlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !crawlUrl) return;

    setCrawlStatus('crawling');
    try {
      await api.post('/documents/crawl', { url: crawlUrl }, {
        headers: { 'x-tenant-id': currentTenant.id },
      });
      setCrawlStatus('success');
      setCrawlUrl('');
      setTimeout(() => setCrawlStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setCrawlStatus('idle');
    }
  };

  if (!currentTenant) return null;

  return (
    <div className="p-5 border-b border-zinc-200 bg-zinc-50/50">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300
          ${isDragging
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-100/50 bg-white'
          }
        `}
      >
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".pdf,.docx,.json,.md,.txt,.csv,.png,.jpg,.jpeg"
        />

        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-zinc-100 rounded-full border border-zinc-200 shadow-sm">
              <UploadCloud className={`w-6 h-6 ${isDragging ? 'text-indigo-500' : 'text-zinc-400'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700">
                {isDragging ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="text-[10px] text-zinc-500 font-medium tracking-wide mt-1 uppercase">
                PDF, DOCX, JSON, MD, TXT, CSV, PNG, JPG
              </p>
            </div>
          </div>
        )}

        {status === 'uploading' && (
          <div className="flex flex-col items-center text-indigo-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm font-medium">Uploading & Processing...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center text-emerald-500">
            <CheckCircle2 className="w-8 h-8 mb-3" />
            <p className="text-sm font-medium">Files queued successfully!</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <form onSubmit={handleCrawlSubmit} className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Globe className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="url"
            value={crawlUrl}
            onChange={(e) => setCrawlUrl(e.target.value)}
            placeholder="https://example.com (Deep Crawl)"
            className="block w-full pl-9 pr-12 py-2.5 sm:text-sm border-zinc-300 rounded-xl bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-all border outline-none text-zinc-800"
            required
          />
          <button
            type="submit"
            disabled={crawlStatus !== 'idle'}
            className="absolute inset-y-1 right-1 px-3 flex items-center bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {crawlStatus === 'crawling' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : crawlStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
