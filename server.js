const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ── PostgreSQL connection ─────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── DB connection test ────────────────────────────────────────────────────────
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      success: true,
      message: 'Database connected!',
      time: result.rows[0].current_time
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err.message
    });
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
    console.log('Anthropic response:', JSON.stringify(data));
    res.json(data);
  } catch (e) {
    console.error('Error:', e.message);
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

// ── NYSE / NASDAQ stock market news only ──────────────────────────────────────
app.get('/news', async (req, res) => {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_API_KEY}`
    );
    const data = await response.json();
    const BLOCK_WORDS = [
      'crypto', 'bitcoin', 'ethereum', 'btc', 'eth', 'coin', 'token', 'blockchain', 'defi', 'nft',
      'gold', 'silver', 'oil', 'crude', 'commodity', 'commodities', 'wheat', 'corn', 'copper', 'natural gas',
      'forex', 'currency', 'dollar index', 'eur/usd', 'gbp/usd', 'usd/jpy', 'yuan', 'peso', 'rupee',
      'treasury', 'bond yield', '10-year', 'gilt', 'bund',
    ];
    const REQUIRE_WORDS = [
      'stock', 'stocks', 'equity', 'equities', 'shares', 'earnings', 'ipo', 'nasdaq', 'nyse',
      's&p', 'dow', 'wall street', 'market', 'investor', 'trading', 'rally', 'selloff', 'sell-off',
      'quarter', 'revenue', 'profit', 'loss', 'guidance', 'analyst', 'upgrade', 'downgrade',
