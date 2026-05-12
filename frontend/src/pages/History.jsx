import { useState, useEffect } from 'react'
import axios from 'axios'
import { useSession } from '../hooks/useSession.js'

export default function History() {
  const { sessionId } = useSession()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    axios.get(`/api/sessions/${sessionId}/history`)
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  if (!sessionId) {
    return <p className="text-gray-500">No session found. <a href="/" className="text-blue-600 underline">Go to Dashboard</a></p>
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Poll History</h1>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!loading && history.length === 0 && (
        <p className="text-gray-500 text-sm">No polls sent yet.</p>
      )}

      <div className="space-y-3">
        {history.map(h => (
          <div key={h.id} className="bg-white rounded-xl shadow p-4 flex items-start gap-4">
            <span className={`text-xl mt-0.5 ${h.status === 'sent' ? '' : 'grayscale'}`}>
              {h.status === 'sent' ? '✅' : '❌'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{h.poll_question}</p>
              <p className="text-xs text-gray-500">
                Group: {h.group_name || '—'} &nbsp;·&nbsp;
                {new Date(h.sent_at * 1000).toLocaleString()}
              </p>
              {h.error && <p className="text-xs text-red-500 mt-0.5">{h.error}</p>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${h.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {h.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
