import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export function useSocket(sessionId) {
  const socketRef = useRef(null)
  const [qrData, setQrData] = useState(null)
  const [status, setStatus] = useState('idle')
  const [lastEvent, setLastEvent] = useState(null)

  useEffect(() => {
    if (!sessionId) return

    const socket = io('/', { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join', sessionId)
    })

    socket.on('qr', ({ qr }) => {
      setQrData(qr)
      setStatus('waiting_scan')
    })

    socket.on('connected', ({ phone }) => {
      setQrData(null)
      setStatus('connected')
      setLastEvent({ type: 'connected', phone })
    })

    socket.on('reconnecting', () => setStatus('reconnecting'))
    socket.on('logged_out', () => setStatus('logged_out'))
    socket.on('connect_timeout', () => setStatus('timeout'))

    socket.on('poll_sent', (data) => setLastEvent({ type: 'poll_sent', ...data }))
    socket.on('poll_failed', (data) => setLastEvent({ type: 'poll_failed', ...data }))

    return () => {
      socket.disconnect()
    }
  }, [sessionId])

  return { qrData, status, lastEvent }
}
