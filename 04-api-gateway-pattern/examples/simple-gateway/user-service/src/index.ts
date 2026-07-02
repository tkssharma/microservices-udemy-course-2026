import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const users = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
];

app.get('/', (_req: Request, res: Response) => {
  res.json(users);
});

app.get('/:id', (req: Request, res: Response) => {
  const user = users.find((u) => u.id === req.params.id);
  user ? res.json(user) : res.status(404).json({ error: 'User not found' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`User Service on port ${PORT}`));
