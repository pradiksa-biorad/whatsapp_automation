import { useState, useEffect, createContext, useContext } from 'react'
import axios from 'axios'

const TOKEN_KEY = 'wa_auth_token'

export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function useAuthProvider() {
  const [auth, setAuth] = useState(null)   // { token, phone, sessionId } | null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On mount, try to restore auth from localStorage
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      // Decode without verifying (server will reject if expired)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp * 1000 > Date.now()) {
          setAuth({ token, phone: payload.phone, sessionId: payload.sessionId })
        } else {
          localStorage.removeItem(TOKEN_KEY)
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY)
      }
    }
    setLoading(false)
  }, [])

  // Called after QR is scanned and WhatsApp confirms connected
  async function loginWithSession(sessionId) {
    const res = await axios.post('/api/auth/verify', { sessionId })
    const { token, phone } = res.data
    localStorage.setItem(TOKEN_KEY, token)
    // Also keep sessionId for legacy hook compat
    localStorage.setItem('wa_survey_session_id', sessionId)
    setAuth({ token, phone, sessionId })
    return res.data
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('wa_survey_session_id')
    setAuth(null)
  }

  return { auth, loading, loginWithSession, logout }
}
