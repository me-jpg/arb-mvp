import { useEffect } from 'react';
import { useStore } from './store';

export function useWebSocket() {
  const addLineChange = useStore((state) => state.addLineChange);
  const setLatencyMetrics = useStore((state) => state.setLatencyMetrics);
  const setWsConnected = useStore((state) => state.setWsConnected);

  useEffect(() => {
    let ws = null;

    function connect() {
      ws = new WebSocket('ws://localhost:8787');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Auto-reconnect after 3 seconds
        setTimeout(() => connect(), 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'line_change') {
          addLineChange(message.data);
        } else if (message.type === 'latency_metric') {
          setLatencyMetrics((prev) => {
            const existing = prev.filter(m => m.book !== message.data.book);
            return [...existing, message.data].sort((a, b) => 
              b.firstMoverFraction - a.firstMoverFraction
            );
          });
        }
      };
    }

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [addLineChange, setLatencyMetrics, setWsConnected]);
}