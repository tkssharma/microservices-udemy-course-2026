import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

// User service has its OWN PostgreSQL database
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'users_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get('/users', async (_req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM users');
  res.json(result.rows);
});

app.get('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  result.rows[0]
    ? res.json(result.rows[0])
    : res.status(404).json({ error: 'User not found' });
});

app.post('/users', async (req: Request, res: Response) => {
  const { name, email } = req.body;
  const result = await pool.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [name, email]
  );
  res.status(201).json(result.rows[0]);
});

const PORT = process.env.PORT || 3001;
initDb().then(() => {
  app.listen(PORT, () => console.log(`User Service (PostgreSQL) on port ${PORT}`));
});
