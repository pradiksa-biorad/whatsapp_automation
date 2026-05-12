import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../hooks/useSession.js'

const STATUS_COLOR = {
  connected: 'bg-green-100 text-green-700',
  disconnected: 'bg-gray-100 text-gray-600',
  reconnecting: 'bg-yellow-100 text-yellow-700',
  waiting_scan: 'bg-blue-100 text-blue-700',
  logged_out: 'bg-red-100 text-red-700',
}

export default function Dashboard() {
  const { sessionId, session, loading, createSession, refreshSession } = useSession()

  useEffect(() => {
    const t = setInterval(refreshSession, 5000)
    return () => clearInterval(t)
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Welcome to WA Survey App</h1>
        <p className="text-gray-500 mb-8">Schedule WhatsApp polls to any group, automatically.</p>
        <button
          onClick={createSession}
          disabled={loading}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Get Started'}
        </button>
      </div>
    )
  }

  const color = STATUS_COLOR[session?.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-sm">Status</span>
          <span className={`px-2 py-0.5 rounded text-sm font-medium ${color}`}>
            {session?.status ?? '…'}
          </span>
        </div>
        {session?.phone && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Phone</span>
            <span className="text-sm font-mono">{session.phone}</span>
          </div>
        )}
        {session?.group_name && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Group</span>
            <span className="text-sm">{session.group_name}</span>
          </div>
        )}
        {session?.cron_schedule && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Schedule</span>
            <span className="text-sm font-mono">{session.cron_schedule} ({session.timezone})</span>
          </div>
        )}
        {session?.nextRun && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Next run</span>
            <span className="text-sm">{new Date(session.nextRun).toLocaleString()}</span>
          </div>
        )}
        {session?.enabled === 1 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Scheduler</span>
            <span className="text-sm text-green-600 font-medium">Enabled</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {session?.status !== 'connected' && (
          <Link to="/connect" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            Connect WhatsApp
          </Link>
        )}
        <Link to="/configure" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Configure Poll
        </Link>
        <Link to="/history" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          View History
        </Link>
      </div>
    </div>
  )
}
