const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Connects to PostgreSQL using environment variables set in Kubernetes
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/studentdb',
});

// 1. Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// 2. Simple Login/Register endpoint (for persistent state test)
app.post('/api/auth/login', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    // Ensure a users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert or find user to prove persistence
    let result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      result = await pool.query('INSERT INTO users (username) VALUES ($1) RETURNING *', [username]);
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Platform status view (safe data, no cluster secrets)
app.get('/api/status', (req, res) => {
  res.json({
    project: 'cloud-hpl-scc26',
    platform: 'student-platform',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});