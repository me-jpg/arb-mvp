import { useWebSocket } from './useWebSocket';
import { LineChangeFeed } from './components/LineChangeFeed';
import { LatencyPanel } from './components/LatencyPanel';
import { ConnectionStatus } from './components/ConnectionStatus';

function App() {
  useWebSocket();

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">
            ⚡ ARB MVP Dashboard
          </h1>
          <ConnectionStatus />
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
          {/* Line Changes Feed */}
          <div className="lg:row-span-2">
            <LineChangeFeed />
          </div>

          {/* Latency Metrics */}
          <div>
            <LatencyPanel />
          </div>

          {/* Placeholder for future panels */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4 text-green-400">📊 Book Status</h2>
            <p className="text-slate-400 text-sm">Coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;