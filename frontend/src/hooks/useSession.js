import { useState, useEffect } from 'react'
import axios from 'axios'

const KEY = 'wa_survey_session_id'

export function useSession() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(KEY))
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)

  async function createSession() {
    setLoading(true)
    try {
      const res = await axios.post('/api/sessions')
      const id = res.data.id
      localStorage.setItem(KEY, id)
      setSessionId(id)
    } finally {
      setLoading(false)
    }
  }

  async function refreshSession() {
    if (!sessionId) return
    try {
      const res = await axios.get(`/api/sessions/${sessionId}`)
      setSession(res.data)
    } catch (e) {
      if (e.response?.status === 404) {
        localStorage.removeItem(KEY)
        setSessionId(null)
        setSession(null)
      }
    }
  }

  useEffect(() => {
    refreshSession()
  }, [sessionId])

  return { sessionId, session, loading, createSession, refreshSession }
}
