import { Navigate, Routes, Route, NavLink } from 'react-router-dom'
import './axiosSetup.js'
import { AuthContext, useAuthProvider } from './hooks/useAuth.js'
import Dashboard from './pages/Dashboard.jsx'
import Connect from './pages/Connect.jsx'
import Configure from './pages/Configure.jsx'
import History from './pages/History.jsx'
import Login from './pages/Login.jsx'

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/connect', label: 'Connect' },
  { to: '/configure', label: 'Configure' },
  { to: '/history', label: 'History' },
]

function ProtectedLayout() {
  const { auth, logout } = useAuthProvider()
  // Re-read from context (passed by App)
  return null // handled below in App
}

export default function App() {
  const authState = useAuthProvider()
  const { auth, loading, logout } = authState

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <svg className="animate-spin w-8 h-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    )
  }

  // Unauthenticated: only show login
  if (!auth) {
    return (
      <AuthContext.Provider value={authState}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthContext.Provider>
    )
  }

  // Authenticated: show full app
  return (
    <AuthContext.Provider value={authState}>
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 px-6 py-0 flex items-center gap-1 shadow-sm sticky top-0 z-10">
          <span className="font-bold text-base text-emerald-600 mr-5 py-4 tracking-tight flex items-center gap-2">
            <span className="text-xl">📊</span> WA Survey
          </span>
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `text-sm font-medium px-3 py-4 border-b-2 transition-colors ${
                  isActive
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3 py-3">
            <span className="text-xs text-slate-400 font-medium hidden sm:block">+{auth.phone}</span>
            <button
              onClick={logout}
              className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Sign out
            </button>
          </div>
        </nav>
        <main className="max-w-2xl mx-auto py-8 px-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/configure" element={<Configure />} />
            <Route path="/history" element={<History />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
  )
}

