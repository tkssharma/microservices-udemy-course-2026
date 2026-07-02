/**
 * ❌ BASIC SERVER - No Optimizations
 * This is how most developers write their first API
 * Problems: Single process, no caching, sync operations
 */

const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

// Simulated database (in real app, this would be actual DB queries)
const fakeDB = {
  users: Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    createdAt: new Date().toISOString()
  }))
};

// ❌ BAD: Simulates slow database query (no caching)
const slowDBQuery = (delay = 50) => {
  return new Promise(resolve => setTimeout(resolve, delay));
};

// ❌ BAD: Blocking CPU-intensive operation
const heavyComputation = (iterations = 1000000) => {
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.random();
  }
  return result;
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid });
});

// ❌ SLOW: No caching, simulates DB latency
app.get('/api/users', async (req, res) => {
  console.log(`[PID: ${process.pid}] Fetching users...`);
  
  // Simulate database query delay
  await slowDBQuery(50);
  
  res.json({
    success: true,
    count: fakeDB.users.length,
    data: fakeDB.users.slice(0, 10),
    pid: process.pid
  });
});

// ❌ SLOW: Individual user lookup (simulates N+1 problem)
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  
  // Simulate slow DB lookup
  await slowDBQuery(30);
  
  const user = fakeDB.users.find(u => u.id === parseInt(id));
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ success: true, data: user, pid: process.pid });
});

// ❌ VERY BAD: Blocking CPU operation
app.get('/api/heavy', (req, res) => {
  console.log(`[PID: ${process.pid}] Starting heavy computation...`);
  
  // This BLOCKS the event loop!
  const result = heavyComputation();
  
  res.json({ 
    success: true, 
    result,
    pid: process.pid,
    warning: 'This endpoint blocks the event loop!'
  });
});

// ❌ BAD: Sync file read
app.get('/api/config', (req, res) => {
  const fs = require('fs');
  
  // ❌ This blocks the event loop!
  // const config = fs.readFileSync('./config.json', 'utf-8');
  
  res.json({ 
    success: true,
    message: 'Config endpoint (sync file read would block here)',
    pid: process.pid
  });
});

// ❌ BAD: No rate limiting - vulnerable to abuse
app.post('/api/data', async (req, res) => {
  await slowDBQuery(100);
  
  res.json({
    success: true,
    message: 'Data saved',
    pid: process.pid
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ❌ BASIC SERVER (No Optimizations)                       ║
║  Server running on http://localhost:${PORT}                   ║
║  PID: ${process.pid}                                            ║
║                                                           ║
║  Problems:                                                ║
║  - Single process (uses 1 CPU core)                       ║
║  - No caching                                             ║
║  - Blocking operations                                    ║
║  - No compression                                         ║
║  - No rate limiting                                       ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
