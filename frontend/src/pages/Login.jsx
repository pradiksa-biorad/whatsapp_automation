import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth.js'
import { useSocket } from '../hooks/useSocket.js'

function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function Login() {
  const { loginWithSession } = useAuth()
  const [sessionId, setSessionId] = useState(null)
  const { qrData, status } = useSocket(sessionId)

  const [phase, setPhase] = useState('idle') // idle | starting | waiting_scan | verifying | failed
  const [error, setError] = useState('')
  const [qrExpired, setQrExpired] = useState(false)
  const qrTimerRef = useRef(null)

  // Sync socket status → phase
  useEffect(() => {
    if (status === 'waiting_scan') { setPhase('waiting_scan'); setQrExpired(false) }
    if (status === 'timeout') {
      setPhase('failed')
      setError('Connection timed out. Try again.')
    }
    if (status === 'connected' && sessionId) {
      setPhase('verifying')
      loginWithSession(sessionId).catch(err => {
        setPhase('failed')
        setError(err.response?.data?.error || 'Login failed. Try again.')
      })
    }
  }, [status])

  // 30s UI safety net
  useEffect(() => {
    if (phase !== 'starting') return
    const t = setTimeout(() => {
      setPhase('failed')
      setError('Timed out waiting for WhatsApp. Try again.')
    }, 30000)
    return () => clearTimeout(t)
  }, [phase])

  // QR expires after 60s
  useEffect(() => {
    if (qrData) {
      clearTimeout(qrTimerRef.current)
      setQrExpired(false)
      qrTimerRef.current = setTimeout(() => setQrExpired(true), 60000)
    }
    return () => clearTimeout(qrTimerRef.current)
  }, [qrData])

  async function handleStart() {
    setPhase('starting')
    setError('')
    setQrExpired(false)
    try {
      const res = await axios.post('/api/auth/start')
      const sid = res.data.sessionId
      setSessionId(sid)
      await axios.post(`/api/sessions/${sid}/connect`)
    } catch (e) {
      setPhase('failed')
      setError(e.response?.data?.error || 'Failed to start. Try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
            <span className="text-3xl">📊</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">WA Survey</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in with your WhatsApp account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8">

          {/* IDLE / FAILED */}
          {(phase === 'idle' || phase === 'failed') && (
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-100">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zm0 9.75h.75v.75h-.75v-.75zm9.75-9.75h.75v.75h-.75v-.75z" />
                </svg>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5 text-left flex gap-2">
                  <span className="shrink-0">⚠️</span> {error}
                </div>
              )}
              <p className="text-slate-500 text-sm mb-6">
                Scan a QR code with WhatsApp to authenticate. No password needed.
              </p>
              <button
                onClick={handleStart}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-2xl transition shadow-sm shadow-emerald-200 active:scale-95"
              >
                {phase === 'failed' ? 'Try Again' : 'Sign in with WhatsApp'}
              </button>
            </div>
          )}

          {/* STARTING */}
          {phase === 'starting' && (
            <div className="text-center py-4">
              <Spinner className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <p className="font-medium text-slate-700">Connecting to WhatsApp…</p>
              <p className="text-slate-400 text-sm mt-1">Generating your QR code</p>
            </div>
          )}

          {/* WAITING SCAN — QR ready */}
          {phase === 'waiting_scan' && qrData && !qrExpired && (
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <img src={qrData} alt="WhatsApp QR Code" className="w-56 h-56 rounded-2xl border border-slate-100" />
                <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold shadow">Scan me</span>
              </div>
              <p className="text-sm font-medium text-slate-700">Open WhatsApp → Linked Devices → Link a Device</p>
              <p className="text-xs text-slate-400 mt-1">QR expires in 60 seconds</p>
            </div>
          )}

          {/* WAITING SCAN — loading QR */}
          {phase === 'waiting_scan' && !qrData && (
            <div className="text-center py-4">
              <Spinner className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <p className="font-medium text-slate-700">Generating QR code…</p>
            </div>
          )}

          {/* QR EXPIRED */}
          {qrExpired && phase === 'waiting_scan' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⏱️</span>
              </div>
              <p className="font-medium text-slate-700 mb-1">QR Code Expired</p>
              <p className="text-slate-400 text-sm mb-5">It wasn't scanned in time.</p>
              <button onClick={handleStart} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-2xl transition">
                Refresh QR
              </button>
            </div>
          )}

          {/* VERIFYING — WhatsApp connected, fetching JWT */}
          {phase === 'verifying' && (
            <div className="text-center py-4">
              <Spinner className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <p className="font-medium text-slate-700">Verifying your account…</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Your WhatsApp number is used as your account identifier.
        </p>
      </div>
    </div>
  )
}
