const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

// ── NYSE market news ──────────────────────────────────────────────────────────
app.get('/news', async (req, res) => {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_API_KEY}`
    );
    const data = await response.json();
    // Filter out crypto, keep stock market news only
    const filtered = data
      .filter(n => {
        const text = (n.headline + ' ' + n.category).toLowerCase();
        return !text.includes('crypto') &&
               !text.includes('bitcoin') &&
               !text.includes('ethereum') &&
               !text.includes('btc') &&
               !text.includes('coin');
      })
      .slice(0, 6);
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Proxy running on port ${PORT}`));
