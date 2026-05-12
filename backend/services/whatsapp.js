const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const AUTH_BASE = path.join(__dirname, '..', '..', 'auth_sessions');
const logger = pino({ level: 'silent' });

// Map of sessionId -> { sock, isConnected, groupJid }
const activeSessions = new Map();

async function connectSession(sessionId, emitFn) {
  // If already connected, nothing to do
  const existing = activeSessions.get(sessionId);
  if (existing?.isConnected) return;

  // Clean up any stale socket before creating a new one
  if (existing?.sock) {
    try { existing.sock.end(undefined); } catch (_) {}
    activeSessions.delete(sessionId);
  }

  const authFolder = path.join(AUTH_BASE, sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false,
    browser: ['WA Survey App', 'Chrome', '120.0.0'],
    connectTimeoutMs: 30000,
  });

  activeSessions.set(sessionId, { sock, isConnected: false, groupJid: null, lastQr: null });

  // Safety timeout: if neither 'open' nor 'qr' fires in 25s, clear stale auth and emit failure
  const safetyTimer = setTimeout(async () => {
    const s = activeSessions.get(sessionId);
    // Only act if this is still the same socket (not replaced by a reconnect)
    if (s && s.sock === sock && !s.isConnected) {
      console.warn(`[${sessionId}] Connection timed out — clearing stale auth`);
      try { sock.end(undefined); } catch (_) {}
      activeSessions.delete(sessionId);
      db.updateSessionStatus(sessionId, 'disconnected');
      // Clear auth so next attempt forces a fresh QR scan
      try { fs.rmSync(authFolder, { recursive: true, force: true }); } catch (_) {}
      emitFn(sessionId, 'connect_timeout', {});
    }
  }, 25000);

  sock.ev.on('connection.update', async (update) => {
    try {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        clearTimeout(safetyTimer);
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 300 });
        const s = activeSessions.get(sessionId);
        if (s) s.lastQr = qrDataUrl;
        emitFn(sessionId, 'qr', { qr: qrDataUrl });
        db.updateSessionStatus(sessionId, 'waiting_scan');
      }

      if (connection === 'open') {
        clearTimeout(safetyTimer);
        const session = activeSessions.get(sessionId);
        if (session) session.isConnected = true;
        const phone = sock.user?.id?.split(':')[0] ?? null;
        db.updateSessionStatus(sessionId, 'connected', phone);
        emitFn(sessionId, 'connected', { phone });
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          const session = activeSessions.get(sessionId);
          if (session) session.isConnected = false;
          db.updateSessionStatus(sessionId, 'logged_out');
          activeSessions.delete(sessionId);
          emitFn(sessionId, 'logged_out', {});
        } else if (activeSessions.has(sessionId)) {
          // Internal Baileys reconnect — cancel the current safety timer before handing off
          clearTimeout(safetyTimer);
          db.updateSessionStatus(sessionId, 'reconnecting');
          emitFn(sessionId, 'reconnecting', {});
          setTimeout(() => connectSession(sessionId, emitFn).catch(() => {}), 5000);
        }
      }
    } catch (err) {
      console.warn('[connection.update] error ignored:', err?.message);
    }
  });

  sock.ev.on('creds.update', saveCreds);
  return sock;
}

async function disconnectSession(sessionId) {
  const session = activeSessions.get(sessionId);
  // Remove first so the close event handler doesn't trigger a reconnect
  activeSessions.delete(sessionId);
  db.updateSessionStatus(sessionId, 'disconnected');
  if (session?.sock) {
    try { session.sock.end(undefined); } catch (_) {}
    session.sock.logout().catch(() => {});
  }
}

async function getGroups(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session?.isConnected) throw new Error('Not connected');
  try {
    const groups = await session.sock.groupFetchAllParticipating();
    return Object.values(groups)
      .filter(g => g.id && g.subject)
      .map(g => ({ jid: g.id, name: g.subject }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    throw new Error('Failed to fetch groups: ' + err.message);
  }
}

async function sendPoll(sessionId, groupJid, question, options) {
  const session = activeSessions.get(sessionId);
  if (!session?.isConnected) throw new Error('Not connected');
  if (!groupJid) throw new Error('No group JID provided');

  await session.sock.sendMessage(groupJid, {
    poll: {
      name: question,
      values: options,
      selectableCount: 1,
    },
  });
}

function isConnected(sessionId) {
  return activeSessions.get(sessionId)?.isConnected ?? false;
}

module.exports = { connectSession, disconnectSession, getGroups, sendPoll, isConnected, activeSessions };
