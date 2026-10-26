// Password hashing (scrypt), signed session tokens and role checks.
const crypto = require('crypto');
const { query } = require('./db');
const { HttpError } = require('./errors');

const ROLES = ['Admin', 'Purchase Manager', 'Sales Staff', 'Viewer'];
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // one working day
// Without AUTH_SECRET a random one is used, so restarting the server logs everyone out.
const SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

// Loads the user on every request, so deactivating or re-roling an account takes effect immediately.
async function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const data = header.startsWith('Bearer ') ? readToken(header.slice(7)) : null;
  if (!data) throw new HttpError(401, 'Please log in');
  const [user] = await query(
    'SELECT User_ID, Full_Name, Email, Role FROM app_user WHERE User_ID = ? AND Is_Active', [data.uid]);
  if (!user) throw new HttpError(401, 'Account not found or deactivated');
  req.user = user;
  next();
}

// Middleware: only the listed roles may continue.
function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.Role)) {
      throw new HttpError(403, `Your role (${req.user.Role}) is not allowed to do this`);
    }
    next();
  };
}

module.exports = { ROLES, hashPassword, verifyPassword, createToken, requireAuth, allow };
