import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useSession } from '../hooks/useSession.js'

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles',
  'Australia/Sydney', 'UTC',
]

export default function Configure() {
  const { sessionId, session, refreshSession } = useSession()
  const navigate = useNavigate()

  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const DEFAULT_FORM = {
    group_jid: '',
    group_name: '',
    poll_question: '🍽️ Will you be opting for office lunch today?',
    poll_options: ['✅ Yes, I\'ll have lunch', '❌ No, I\'ll skip today'],
    cron_schedule: '0 7 * * *',
    timezone: 'Asia/Kolkata',
    enabled: false,
  }

  const [savedForm, setSavedForm] = useState(DEFAULT_FORM)
  const [form, setForm] = useState({
    group_jid: '',
    group_name: '',
    poll_question: '🍽️ Will you be opting for office lunch today?',
    poll_options: ['✅ Yes, I\'ll have lunch', '❌ No, I\'ll skip today'],
    cron_schedule: '0 7 * * *',
    timezone: 'Asia/Kolkata',
    enabled: false,
  })

  // True when form differs from last-saved state
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm)

  const applySession = useCallback((s, base) => ({
    ...base,
    group_jid: s.group_jid || '',
    group_name: s.group_name || '',
    poll_question: s.poll_question || base.poll_question,
    poll_options: Array.isArray(s.poll_options) && s.poll_options.length ? s.poll_options : base.poll_options,
    cron_schedule: s.cron_schedule || base.cron_schedule,
    timezone: s.timezone || base.timezone,
    enabled: s.enabled === 1,
  }), [])

  useEffect(() => {
    if (session) {
      const loaded = applySession(session, DEFAULT_FORM)
      setForm(loaded)
      setSavedForm(loaded)
    }
  }, [session])

  async function loadGroups() {
    if (!sessionId) return
    setGroupsLoading(true)
    setError('')
    try {
      const res = await axios.get(`/api/sessions/${sessionId}/groups`)
      setGroups(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load groups. Make sure WhatsApp is connected.')
    } finally {
      setGroupsLoading(false)
    }
  }

  function handleGroupSelect(e) {
    const jid = e.target.value
    const g = groups.find(g => g.jid === jid)
    setForm(f => ({ ...f, group_jid: jid, group_name: g?.name || '' }))
  }

  function handleOptionChange(i, val) {
    setForm(f => {
      const opts = [...f.poll_options]
      opts[i] = val
      return { ...f, poll_options: opts }
    })
  }

  function addOption() {
    if (form.poll_options.length >= 12) return
    setForm(f => ({ ...f, poll_options: [...f.poll_options, ''] }))
  }

  function removeOption(i) {
    if (form.poll_options.length <= 2) return
    setForm(f => ({ ...f, poll_options: f.poll_options.filter((_, idx) => idx !== i) }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!sessionId) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await axios.put(`/api/sessions/${sessionId}/config`, {
        ...form,
        poll_options: form.poll_options.filter(o => o.trim()),
        enabled: form.enabled,
      })
      await refreshSession()
      setSavedForm({ ...form, poll_options: form.poll_options.filter(o => o.trim()) })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setForm(savedForm)
    setError('')
    setSaved(false)
  }

  async function handleSendNow() {
    if (!sessionId) return
    if (!form.group_jid) {
      setError('No group selected. Pick a group from the dropdown first.')
      return
    }
    setSending(true)
    setError('')
    try {
      // Auto-save current form so the backend has the latest group + poll config
      await axios.put(`/api/sessions/${sessionId}/config`, {
        ...form,
        poll_options: form.poll_options.filter(o => o.trim()),
      })
      await axios.post(`/api/sessions/${sessionId}/send-now`)
      navigate('/history')
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send poll')
    } finally {
      setSending(false)
    }
  }

  if (!sessionId) {
    return <p className="text-slate-500">No session found. <a href="/" className="text-emerald-600 underline">Go to Dashboard</a></p>
  }

  const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
  const selectCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
  const cardCls = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5"
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Configure Poll</h1>
          <p className="text-slate-400 text-sm mt-0.5">Set up your WhatsApp group poll and schedule</p>
        </div>
        {isDirty && (
          <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-full font-semibold">Unsaved changes</span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Group */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">💬</span>
            <h2 className="font-semibold text-slate-700">WhatsApp Group</h2>
          </div>
          <div className="flex gap-2.5 items-center">
            <select
              className={selectCls + ' flex-1'}
              value={form.group_jid}
              onChange={handleGroupSelect}
              disabled={groups.length === 0}
            >
              {groups.length === 0
                ? <option value="">{form.group_name || 'Click "Load Groups" to see your groups'}</option>
                : <>
                    <option value="">Select a group…</option>
                    {groups.map(g => <option key={g.jid} value={g.jid}>{g.name}</option>)}
                  </>
              }
            </select>
            <button
              type="button"
              onClick={loadGroups}
              disabled={groupsLoading}
              className="shrink-0 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium px-4 py-2.5 rounded-xl text-sm transition disabled:opacity-50 shadow-sm"
            >
              {groupsLoading ? 'Loading…' : 'Load Groups'}
            </button>
          </div>
          {form.group_name && form.group_jid && (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
              <span>✓</span> {form.group_name} selected
            </p>
          )}
        </div>

        {/* Poll */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">📋</span>
            <h2 className="font-semibold text-slate-700">Poll Content</h2>
          </div>

          <div>
            <label className={labelCls}>Question</label>
            <input
              type="text"
              className={inputCls}
              value={form.poll_question}
              onChange={e => setForm(f => ({ ...f, poll_question: e.target.value }))}
              placeholder="e.g. Will you be opting for lunch today?"
              required
            />
          </div>

          <div>
            <label className={labelCls}>Options <span className="normal-case font-normal text-slate-400">(2–12)</span></label>
            <div className="space-y-2">
              {form.poll_options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-slate-300 text-xs font-bold w-5 text-center">{i + 1}</span>
                  <input
                    type="text"
                    className={inputCls}
                    value={opt}
                    onChange={e => handleOptionChange(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    required
                  />
                  {form.poll_options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition text-xl"
                    >×</button>
                  )}
                </div>
              ))}
            </div>
            {form.poll_options.length < 12 && (
              <button type="button" onClick={addOption} className="mt-3 text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1">
                <span className="text-base leading-none">+</span> Add option
              </button>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🕐</span>
            <h2 className="font-semibold text-slate-700">Schedule</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cron expression</label>
              <input
                type="text"
                className={inputCls + ' font-mono'}
                value={form.cron_schedule}
                onChange={e => setForm(f => ({ ...f, cron_schedule: e.target.value }))}
                placeholder="0 7 * * *"
                required
              />
              <p className="text-xs text-slate-400 mt-1.5">
                <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline font-medium">crontab.guru</a>
                {' '}— e.g. <code className="bg-slate-100 px-1 rounded text-xs">0 7 * * *</code> = daily 7 AM
              </p>
            </div>
            <div>
              <label className={labelCls}>Timezone</label>
              <select
                className={selectCls}
                value={form.timezone}
                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer group mt-1">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-colors"></div>
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
            </div>
            <div>
              <span className="text-sm font-medium text-slate-700">Enable automatic sending</span>
              <p className="text-xs text-slate-400">Poll will be sent automatically at the scheduled time</p>
            </div>
          </label>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            <span className="shrink-0 mt-0.5">⚠️</span> {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 font-medium">
            <span>✓</span> Configuration saved successfully!
          </div>
        )}

        <div className="flex gap-3 flex-wrap pt-1">
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={handleCancel}
              className="border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 shadow-sm transition"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSendNow}
            disabled={sending || !session?.connected}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
          >
            {sending ? 'Sending…' : 'Send Now'}
          </button>
        </div>
      </form>
    </div>
  )
}
