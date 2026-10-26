// Staff account management (Admin only).
const express = require('express');
const { query } = require('../db');
const { HttpError } = require('../errors');
const { pick, id } = require('../validate');
const { ROLES, hashPassword } = require('../auth');

const router = express.Router();
const COLUMNS = 'User_ID, Full_Name, Email, Role, Is_Active, Created_At, Last_Login';

const fields = {
  Full_Name: { type: 'string', required: true, max: 100 },
  Email: { type: 'string', required: true, max: 100 },
  Role: { type: 'string', required: true },
  Password: { type: 'string', required: true, max: 200 },
  Is_Active: { type: 'int' },
};

function toRow(data) {
  if (data.Role !== undefined && !ROLES.includes(data.Role)) throw new HttpError(400, `Role must be one of ${ROLES.join(', ')}`);
  if (data.Is_Active !== undefined && data.Is_Active !== null) data.Is_Active = data.Is_Active ? 1 : 0;
  else delete data.Is_Active;
  if (data.Password !== undefined) {
    if (data.Password === null) delete data.Password;
    else {
      if (data.Password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
      data.Password_Hash = hashPassword(data.Password);
      delete data.Password;
    }
  }
  return data;
}

router.get('/', async (req, res) => {
  res.json(await query(`SELECT ${COLUMNS} FROM app_user ORDER BY FIELD(Role, ${ROLES.map(() => '?').join(',')}), Full_Name`, ROLES));
});

router.post('/', async (req, res) => {
  const row = toRow(pick(req.body, fields));
  const result = await query('INSERT INTO app_user SET ?', [row]);
  const [user] = await query(`SELECT ${COLUMNS} FROM app_user WHERE User_ID = ?`, [result.insertId]);
  res.status(201).json(user);
});

router.put('/:id', async (req, res) => {
  const key = id(req.params.id);
  const row = toRow(pick(req.body, fields, { partial: true }));
  if (!Object.keys(row).length) throw new HttpError(400, 'No fields to update');
  const result = await query('UPDATE app_user SET ? WHERE User_ID = ?', [row, key]);
  if (!result.affectedRows) throw new HttpError(404, 'User not found');
  const [user] = await query(`SELECT ${COLUMNS} FROM app_user WHERE User_ID = ?`, [key]);
  res.json(user);
});

router.delete('/:id', async (req, res) => {
  const key = id(req.params.id);
  if (key === req.user.User_ID) throw new HttpError(400, 'You cannot delete your own account');
  const result = await query('DELETE FROM app_user WHERE User_ID = ?', [key]);
  if (!result.affectedRows) throw new HttpError(404, 'User not found');
  res.status(204).end();
});

module.exports = router;
