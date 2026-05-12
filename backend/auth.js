const jwt = require('jsonwebtoken');

// Use env var in production; fallback for dev
const SECRET = process.env.JWT_SECRET || 'wa-survey-dev-secret-change-in-prod';
const EXPIRY = '30d';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// Express middleware — attaches req.user or returns 401
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid or expired token' });

  // Ensure user can only access their own session
  const paramId = req.params?.id;
  if (paramId && paramId !== decoded.sessionId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  req.user = decoded; // { phone, sessionId }
  next();
}

module.exports = { signToken, verifyToken, requireAuth };
