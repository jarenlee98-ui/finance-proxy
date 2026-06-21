const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Create store table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log('DB ready')).catch(e => console.error('DB init error:', e.message));

// ── DB connection test ────────────────────────────────────────────────────────
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ success: true, message: 'Database connected!', time: result.rows[0].current_time });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database connection failed', error: err.message });
  }
});

// ── Key-value store ───────────────────────────────────────────────────────────
app.get('/store/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query('SELECT value FROM kv_store WHERE key = $1', [key]);
    if (result.rows.length === 0) return res.status(404).json({ value: null });
    res.json({ value: result.rows[0].value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/store/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await pool.query(`
      INSERT INTO kv_store (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, JSON.stringify(value)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/store/:key', async (req, res) => {
  try {
    const { key } = req.params;
    await pool.query('DELETE FROM kv_store WHERE key = $1', [key]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Claude proxy ──────────────────────────────────────────────────────────────
app.post('/chat', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Live stock quote ──────────────────────────────────────────────────────────
app.get('/stock/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Proxy running on port ${PORT}`));
