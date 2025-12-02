import { useEffect, useRef, useCallback } from 'react'
import { useStore } from './store'

const WS_URL = `ws://localhost:${import.meta.env.VITE_WS_PORT || 8787}`
const RECONNECT_DELAY = 3000

export function useWebSocket() {
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  
  const { 
    setConnected, 
    setLastPing, 
    addLineChange, 
    setLatencyMetrics,
    updateStats 
  } = useStore()
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    
    console.log('🔌 Connecting to WebSocket...', WS_URL)
    
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected')
      setConnected(true)
      setLastPing(Date.now())
    }
    
    ws.onclose = () => {
      console.log('❌ WebSocket disconnected')
      setConnected(false)
      
      // Auto-reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Attempting reconnect...')
        connect()
      }, RECONNECT_DELAY)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleMessage(message)
      } catch (err) {
        console.error('Failed to parse message:', err)
      }
    }
  }, [setConnected, setLastPing])
  
  const handleMessage = useCallback((message) => {
    switch (message.type) {
      case 'ping':
        setLastPing(Date.now())
        break
        
      case 'line_change':
        addLineChange({
          ...message.data,
          receivedAt: Date.now()
        })
        break
        
      case 'latency_update':
        setLatencyMetrics(message.data)
        break
        
      case 'stats_update':
        updateStats(message.data)
        break
        
      case 'welcome':
        console.log('📡 Server:', message.message)
        break
        
      default:
        console.log('Unknown message type:', message.type)
    }
  }, [setLastPing, addLineChange, setLatencyMetrics, updateStats])
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])
  
  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])
  
  return {
    connected: useStore((s) => s.connected),
    reconnect: connect
  }
}


