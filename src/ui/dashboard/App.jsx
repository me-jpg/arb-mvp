import React, { useState, useEffect } from 'react';
import ConnectionStatus from './components/ConnectionStatus.jsx';
import ConfigSummaryCard from './components/ConfigSummaryCard.jsx';
import ExecutionHealthCard from './components/ExecutionHealthCard.jsx';
import HfMarketsCard from './components/HfMarketsCard.jsx';
import LatencyAnomaliesCard from './components/LatencyAnomaliesCard.jsx';
import ExecutionSummaryCard from './components/ExecutionSummaryCard.jsx';
import RiskSummaryCard from './components/RiskSummaryCard.jsx';
import ResearchCard from './components/ResearchCard.jsx';
import ArbExposureCard from './components/ArbExposureCard.jsx';

function App() {
    const [metrics, setMetrics] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:4090');

        ws.onopen = () => {
            console.log('[WS] Connected');
            setConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setMetrics(data);
            } catch (err) {
                console.error('[WS] Parse error:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('[WS] Error:', error);
            setConnected(false);
        };

        ws.onclose = () => {
            console.log('[WS] Disconnected');
            setConnected(false);
        };

        return () => {
            ws.close();
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-blue-400">ArbMVP Live Metrics</h1>
                    <ConnectionStatus connected={connected} />
                </div>
                {metrics?.ts && (
                    <p className="text-gray-400 text-sm mt-2">
                        Last update: {new Date(metrics.ts).toLocaleString()}
                    </p>
                )}
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <ConfigSummaryCard config={metrics?.config} />
                <ExecutionHealthCard executionHealth={metrics?.executionHealth} />
                <HfMarketsCard hf={metrics?.hf} />
                <LatencyAnomaliesCard latency={metrics?.latency} />
                <ExecutionSummaryCard execution={metrics?.execution} />
                <RiskSummaryCard risk={metrics?.risk} />
                <ResearchCard research={metrics?.research} />
                <ArbExposureCard arbExposure={metrics?.arbExposure} />
            </div>
        </div>
    );
}

export default App;
