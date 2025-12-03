// dashboard/src/useWebSocket.js
import { useEffect } from 'react';
import { useStore } from './store';

export default function useWebSocket() {
  const addLineChange = useStore(state => state.addLineChange);
  const setLatencyMetrics = useStore(state => state.setLatencyMetrics);
  const addArbitrageOpportunity = useStore(state => state.addArbitrageOpportunity);
  const setWsConnected = useStore(state => state.setWsConnected);

  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connect = () => {
      ws = new WebSocket('ws://localhost:8787');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'line_change') {
            addLineChange(message.data);
          } else if (message.type === 'latency_metric') {
            setLatencyMetrics(prevMetrics => {
              const filtered = prevMetrics.filter(m => m.book !== message.data.book);
              return [...filtered, message.data];
            });
          } else if (message.type === 'arbitrage_opportunity') {
            addArbitrageOpportunity(message.data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [addLineChange, setLatencyMetrics, addArbitrageOpportunity, setWsConnected]);
}