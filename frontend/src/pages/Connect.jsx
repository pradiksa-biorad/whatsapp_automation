import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useSession } from '../hooks/useSession.js'
import { useSocket } from '../hooks/useSocket.js'

// Spinner SVG
function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// Step indicator
const STEPS = [
  { key: 'idle',         label: 'Generate QR'        },
  { key: 'starting',    label: 'Connecting…'         },
  { key: 'waiting_scan',label: 'Scan QR Code'        },
  { key: 'connected',   label: 'Connected!'          },
]

export default function Connect() {
  const { sessionId, session, createSession, refreshSession } = useSession()
  const { qrData, status } = useSocket(sessionId)
  const [phase, setPhase] = useState('idle') // idle | starting | waiting_scan | connected | failed
  const [error, setError] = useState('')
  const [qrExpired, setQrExpired] = useState(false)
  const navigate = useNavigate()
  const qrTimerRef = useRef(null)

  // Sync socket status → phase
  useEffect(() => {
    if (status === 'waiting_scan') { setPhase('waiting_scan'); setQrExpired(false) }
    if (status === 'connected')    { setPhase('connected') }
    if (status === 'reconnecting' && phase !== 'idle') setPhase('starting')
    if (status === 'timeout') {
      setPhase('failed')
      setError('Connection timed out. WhatsApp did not respond in time. Try again.')
    }
    if (status === 'logged_out') {
      setPhase('idle')
      setError('Session was logged out. Generate a new QR code to reconnect.')
    }
  }, [status])

  // UI-side safety: if stuck in 'starting' for 30s, show error
  useEffect(() => {
    if (phase !== 'starting') return
    const t = setTimeout(() => {
      setPhase('failed')
      setError('Timed out waiting for WhatsApp. Check your internet and try again.')
    }, 30000)
    return () => clearTimeout(t)
  }, [phase])

  // QR expires after 60s if not scanned
  useEffect(() => {
    if (qrData) {
      clearTimeout(qrTimerRef.current)
      setQrExpired(false)
      qrTimerRef.current = setTimeout(() => setQrExpired(true), 60000)
    }
    return () => clearTimeout(qrTimerRef.current)
  }, [qrData])

  async function handleConnect() {
    let sid = sessionId
    if (!sid) {
      await createSession()
      sid = localStorage.getItem('wa_survey_session_id')
    }
    setPhase('starting')
    setError('')
    setQrExpired(false)
    try {
      await axios.post(`/api/sessions/${sid}/connect`)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to start connection. Try again.')
      setPhase('failed')
    }
  }

  async function handleDisconnect() {
    if (!sessionId) return
    setPhase('idle')
    setError('')
    await axios.post(`/api/sessions/${sessionId}/disconnect`).catch(() => {})
    await refreshSession()
  }

  const isConnected = session?.connected || phase === 'connected'

  if (isConnected) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-1">WhatsApp Connected!</h2>
        {session?.phone && <p className="text-gray-500 mb-6 text-sm">Phone: +{session.phone}</p>}
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/configure')} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700">
            Configure Poll →
          </button>
          <button onClick={handleDisconnect} className="border border-red-300 text-red-600 px-5 py-2 rounded-lg font-medium hover:bg-red-50">
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  const stepIndex = STEPS.findIndex(s => s.key === (phase === 'failed' ? 'idle' : phase === 'starting' ? 'starting' : phase))

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-1">Connect WhatsApp</h1>
      <p className="text-gray-500 mb-6 text-sm">Scan the QR code with your WhatsApp to link your account.</p>

      {/* Step progress */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 shrink-0 transition-colors
              ${i < stepIndex ? 'bg-green-500 border-green-500 text-white'
              : i === stepIndex ? 'border-green-500 text-green-600 bg-white'
              : 'border-gray-300 text-gray-400 bg-white'}`}>
              {i < stepIndex
                ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                : i + 1}
            </div>
            <span className={`ml-1.5 text-xs hidden sm:block ${i === stepIndex ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < stepIndex ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Main content area */}
      <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center min-h-[280px] justify-center">

        {/* IDLE / FAILED */}
        {(phase === 'idle' || phase === 'failed') && (
          <div className="text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zm0 9.75h.75v.75h-.75v-.75zm9.75-9.75h.75v.75h-.75v-.75z" />
              </svg>
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              onClick={handleConnect}
              className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-green-700 active:scale-95 transition-transform"
            >
              {phase === 'failed' ? 'Try Again' : 'Generate QR Code'}
            </button>
          </div>
        )}

        {/* STARTING — waiting for backend to initiate */}
        {phase === 'starting' && (
          <div className="text-center">
            <Spinner className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <p className="font-medium text-gray-700">Connecting to WhatsApp…</p>
            <p className="text-gray-400 text-sm mt-1">This may take a few seconds</p>
          </div>
        )}

        {/* WAITING SCAN — QR ready */}
        {phase === 'waiting_scan' && qrData && !qrExpired && (
          <div className="text-center w-full">
            <div className="relative inline-block">
              <img src={qrData} alt="WhatsApp QR Code" className="w-52 h-52 rounded-lg" />
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Ready</span>
            </div>
            <p className="text-sm font-medium text-gray-700 mt-3">Open WhatsApp → Linked Devices → Link a Device</p>
            <p className="text-xs text-gray-400 mt-1">QR code expires in 60 seconds</p>
          </div>
        )}

        {/* WAITING SCAN — still waiting for QR image */}
        {phase === 'waiting_scan' && !qrData && (
          <div className="text-center">
            <Spinner className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <p className="font-medium text-gray-700">Generating QR code…</p>
          </div>
        )}

        {/* QR EXPIRED */}
        {qrExpired && phase === 'waiting_scan' && (
          <div className="text-center">
            <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="font-medium text-gray-700 mb-1">QR Code Expired</p>
            <p className="text-gray-400 text-sm mb-4">It wasn't scanned in time.</p>
            <button onClick={handleConnect} className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-green-700">
              Refresh QR
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
