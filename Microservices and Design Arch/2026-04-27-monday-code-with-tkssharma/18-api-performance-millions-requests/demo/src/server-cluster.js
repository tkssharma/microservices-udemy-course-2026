/**
 * ✅ CLUSTER SERVER - Uses all CPU cores
 * Performance boost: ~8x on 8-core machine!
 */

const cluster = require('cluster');
const os = require('os');
const express = require('express');

const numCPUs = os.cpus().length;
const PORT = 3001;

if (cluster.isMaster) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ CLUSTER SERVER                                        ║
║  Master PID: ${process.pid}                                     ║
║  CPU Cores: ${numCPUs}                                            ║
║  Forking ${numCPUs} workers...                                    ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker crashes - auto restart
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️  Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });

} else {
  // Worker process - runs the Express app
  const app = express();
  app.use(express.json());

  // Simulated database
  const fakeDB = {
    users: Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      createdAt: new Date().toISOString()
    }))
  };

  const slowDBQuery = (delay = 50) => {
    return new Promise(resolve => setTimeout(resolve, delay));
  };

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      pid: process.pid,
      workerId: cluster.worker.id
    });
  });

  // Users endpoint
  app.get('/api/users', async (req, res) => {
    console.log(`[Worker ${cluster.worker.id} - PID: ${process.pid}] Handling request`);
    
    await slowDBQuery(50);
    
    res.json({
      success: true,
      count: fakeDB.users.length,
      data: fakeDB.users.slice(0, 10),
      pid: process.pid,
      workerId: cluster.worker.id
    });
  });

  // Single user
  app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    await slowDBQuery(30);
    
    const user = fakeDB.users.find(u => u.id === parseInt(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      data: user, 
      pid: process.pid,
      workerId: cluster.worker.id
    });
  });

  // Stats endpoint
  app.get('/api/stats', (req, res) => {
    res.json({
      workers: numCPUs,
      currentWorker: cluster.worker.id,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Worker ${cluster.worker.id} listening on port ${PORT}`);
  });
}
