// dashboard/src/App.jsx
import ConnectionStatus from './components/ConnectionStatus';
import LineChangeFeed from './components/LineChangeFeed';
import LatencyPanel from './components/LatencyPanel';
import ArbitrageFeed from './components/ArbitrageFeed';
import useWebSocket from './useWebSocket';

function App() {
  useWebSocket();

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">ARB-MVP Dashboard</h1>
        <ConnectionStatus />
      </div>

      {/* Main Grid - 3 columns */}
      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-120px)]">
        {/* Left Column - Line Changes */}
        <div className="col-span-1">
          <LineChangeFeed />
        </div>

        {/* Middle Column - Arbitrage Opportunities */}
        <div className="col-span-1">
          <ArbitrageFeed />
        </div>

        {/* Right Column - Stats */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="flex-1">
            <LatencyPanel />
          </div>
          <div className="flex-1 bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">📊 System Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Status</span>
                <span className="text-green-400 font-semibold">Running</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Books Active</span>
                <span className="text-white font-semibold">3</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Markets Tracked</span>
                <span className="text-white font-semibold">ML, Spread, Total</span>
              </div>
              <div className="pt-3 border-t border-slate-700">
                <div className="text-slate-500 text-xs">
                  Real-time arbitrage detection active
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;