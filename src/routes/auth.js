const express = require('express');
const { query } = require('../db');
const { HttpError } = require('../errors');
const { pick } = require('../validate');
const { verifyPassword, hashPassword, createToken, requireAuth } = require('../auth');

const router = express.Router();

// Shown on the login page for live demos; set SHOW_DEMO_ACCOUNTS=false to hide.
const DEMO_ACCOUNTS = [
  { Email: 'admin@inventory.demo', Password: 'Admin@123', Role: 'Admin' },
  { Email: 'purchase@inventory.demo', Password: 'Purchase@123', Role: 'Purchase Manager' },
  { Email: 'sales@inventory.demo', Password: 'Sales@123', Role: 'Sales Staff' },
  { Email: 'viewer@inventory.demo', Password: 'Viewer@123', Role: 'Viewer' },
];

router.get('/demo-accounts', (req, res) => {
  res.json(process.env.SHOW_DEMO_ACCOUNTS === 'false' ? [] : DEMO_ACCOUNTS);
});

router.post('/login', async (req, res) => {
  const { Email, Password } = pick(req.body, {
    Email: { type: 'string', required: true, max: 100 },
    Password: { type: 'string', required: true, max: 200 },
  });
  const [user] = await query('SELECT * FROM app_user WHERE Email = ?', [Email]);
  if (!user || !verifyPassword(Password, user.Password_Hash)) throw new HttpError(401, 'Invalid email or password');
  if (!user.Is_Active) throw new HttpError(403, 'This account has been deactivated');
  await query('UPDATE app_user SET Last_Login = CURRENT_TIMESTAMP WHERE User_ID = ?', [user.User_ID]);
  res.json({
    token: createToken(user.User_ID),
    user: { User_ID: user.User_ID, Full_Name: user.Full_Name, Email: user.Email, Role: user.Role },
  });
});

router.get('/me', requireAuth, (req, res) => res.json(req.user));

router.post('/change-password', requireAuth, async (req, res) => {
  const { Current_Password, New_Password } = pick(req.body, {
    Current_Password: { type: 'string', required: true },
    New_Password: { type: 'string', required: true, max: 200 },
  });
  if (New_Password.length < 6) throw new HttpError(400, 'New password must be at least 6 characters');
  const [user] = await query('SELECT Password_Hash FROM app_user WHERE User_ID = ?', [req.user.User_ID]);
  if (!verifyPassword(Current_Password, user.Password_Hash)) throw new HttpError(400, 'Current password is incorrect');
  await query('UPDATE app_user SET Password_Hash = ? WHERE User_ID = ?', [hashPassword(New_Password), req.user.User_ID]);
  res.json({ ok: true });
});

module.exports = router;
