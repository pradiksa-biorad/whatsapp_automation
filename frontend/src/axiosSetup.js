import axios from 'axios'
import { getStoredToken } from './hooks/useAuth.js'

// Attach JWT to every request
axios.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear stored auth so user is redirected to login
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wa_auth_token')
      localStorage.removeItem('wa_survey_session_id')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
