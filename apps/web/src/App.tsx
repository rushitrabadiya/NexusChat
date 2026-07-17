import { Sidebar } from './components/Sidebar';
import { UploadZone } from './components/UploadZone';
import { DocumentList } from './components/DocumentList';
import { ChatSessionList } from './components/ChatSessionList';
import { Chat } from './components/Chat';

function App() {
  return (
    <div className="flex h-screen w-full overflow-hidden text-zinc-800 font-sans bg-zinc-50">
      <Sidebar />
      <div className="w-[340px] flex flex-col border-r border-zinc-200 bg-white z-10 shrink-0 shadow-sm">
        <UploadZone />
        <DocumentList />
        <ChatSessionList />
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-transparent">
        <Chat />
      </div>
    </div>
  );
}

export default App;
