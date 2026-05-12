const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const wa = require('./services/whatsapp');
const scheduler = require('./services/scheduler');
const { signToken, requireAuth } = require('./auth');

// Prevent Baileys internal timeouts/rejections from crashing the server
process.on('unhandledRejection', (reason) => {
  console.warn('[unhandledRejection] Ignored:', reason?.message ?? reason);
});
process.on('uncaughtException', (err) => {
  console.warn('[uncaughtException] Ignored:', err?.message ?? err);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// Serve React build in production
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(DIST));
}

// ---- Socket.io ----
const emitFn = (sessionId, event, data) => {
  io.to(sessionId).emit(event, data);
};

io.on('connection', (socket) => {
  socket.on('join', (sessionId) => {
    socket.join(sessionId);
    // Replay last QR if session is still waiting for scan (race condition fix)
    const s = wa.activeSessions.get(sessionId);
    if (s && !s.isConnected && s.lastQr) {
      socket.emit('qr', { qr: s.lastQr });
    }
  });
});

// ---- REST API ----

// POST /api/auth/start — create a temp session for QR login (no auth required)
app.post('/api/auth/start', (req, res) => {
  const id = uuidv4();
  db.createSession(id);
  res.json({ sessionId: id });
});

// POST /api/auth/verify — called after QR scan; returns JWT if session is connected
app.post('/api/auth/verify', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = db.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.phone) return res.status(400).json({ error: 'Not yet connected' });

  const token = signToken({ phone: session.phone, sessionId });
  res.json({ token, phone: session.phone, sessionId });
});

// POST /api/sessions — create a new session (legacy, keep for compat)
app.post('/api/sessions', (req, res) => {
  const id = uuidv4();
  db.createSession(id);
  res.json({ id });
});

// GET /api/sessions/:id — get session info
app.get('/api/sessions/:id', requireAuth, (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const connected = wa.isConnected(req.params.id);
  const nextRun = scheduler.getNextRun(req.params.id);
  let poll_options = [];
  try { poll_options = JSON.parse(session.poll_options || '[]'); } catch {}

  res.json({ ...session, poll_options, connected, nextRun });
});

// POST /api/sessions/:id/connect — initiate WhatsApp connection + QR (no auth — called during login flow)
app.post('/api/sessions/:id/connect', async (req, res) => {
  const { id } = req.params;
  const session = db.getSession(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    await wa.connectSession(id, emitFn);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/disconnect
app.post('/api/sessions/:id/disconnect', requireAuth, async (req, res) => {
  const { id } = req.params;
  scheduler.unscheduleSession(id);
  await wa.disconnectSession(id);
  res.json({ ok: true });
});

// GET /api/sessions/:id/groups — list WhatsApp groups
app.get('/api/sessions/:id/groups', requireAuth, async (req, res) => {
  try {
    const groups = await wa.getGroups(req.params.id);
    res.json(groups);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/sessions/:id/config — save config & toggle scheduler
app.put('/api/sessions/:id/config', requireAuth, (req, res) => {
  const { id } = req.params;
  const session = db.getSession(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  db.saveConfig(id, req.body);

  // Reload updated session
  const updated = db.getSession(id);
  if (updated.enabled) {
    const nextRun = scheduler.scheduleSession(id, updated.cron_schedule, updated.timezone, emitFn);
    return res.json({ ok: true, nextRun });
  } else {
    scheduler.unscheduleSession(id);
    return res.json({ ok: true, nextRun: null });
  }
});

// POST /api/sessions/:id/send-now — manual trigger
app.post('/api/sessions/:id/send-now', requireAuth, async (req, res) => {
  const { id } = req.params;
  const session = db.getSession(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!wa.isConnected(id)) return res.status(400).json({ error: 'Not connected' });
  if (!session.group_jid) return res.status(400).json({ error: 'No group selected. Configure a group first.' });

  let options = [];
  try { options = JSON.parse(session.poll_options || '[]'); } catch {}

  try {
    await wa.sendPoll(id, session.group_jid, session.poll_question, options);
    const entry = { group_name: session.group_name, poll_question: session.poll_question, status: 'sent' };
    db.addHistory(id, entry);
    emitFn(id, 'poll_sent', { at: new Date().toISOString(), group: session.group_name });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id/history
app.get('/api/sessions/:id/history', requireAuth, (req, res) => {
  const history = db.getHistory(req.params.id, 50);
  res.json(history);
});

// Fallback to React app (production only)
if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

// ---- Restore scheduled jobs on startup ----
function restoreSchedules() {
  const sessions = db.getAllSessions();
  for (const s of sessions) {
    if (s.enabled && s.cron_schedule) {
      try {
        scheduler.scheduleSession(s.id, s.cron_schedule, s.timezone || 'UTC', emitFn);
        console.log(`Restored schedule for session ${s.id}`);
      } catch (e) {
        console.error(`Failed to restore schedule for ${s.id}:`, e.message);
      }
    }
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WA Survey App running on http://localhost:${PORT}`);
  restoreSchedules();
});
