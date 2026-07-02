import express, { Request, Response } from 'express';
import { MongoClient, Db, ObjectId } from 'mongodb';

const app = express();
app.use(express.json());

// Order service has its OWN MongoDB database
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'orders_db';

let db: Db;

async function connectDb() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB');
}

app.get('/orders', async (_req: Request, res: Response) => {
  const orders = await db.collection('orders').find().toArray();
  res.json(orders);
});

app.get('/orders/:id', async (req: Request, res: Response) => {
  const order = await db.collection('orders').findOne({
    _id: new ObjectId(req.params.id),
  });
  order ? res.json(order) : res.status(404).json({ error: 'Order not found' });
});

app.post('/orders', async (req: Request, res: Response) => {
  const { userId, items, total } = req.body;
  const order = {
    userId,
    items,
    total,
    status: 'pending',
    createdAt: new Date(),
  };
  const result = await db.collection('orders').insertOne(order);
  res.status(201).json({ ...order, _id: result.insertedId });
});

const PORT = process.env.PORT || 3002;
connectDb().then(() => {
  app.listen(PORT, () => console.log(`Order Service (MongoDB) on port ${PORT}`));
});
