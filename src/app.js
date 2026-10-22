const path = require('path');
const express = require('express');
const { query } = require('./db');
const { errorHandler } = require('./errors');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', async (req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok' });
});

app.use('/api', require('./routes/master'));
app.use('/api', require('./routes/orders'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/reports', require('./routes/reports'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
