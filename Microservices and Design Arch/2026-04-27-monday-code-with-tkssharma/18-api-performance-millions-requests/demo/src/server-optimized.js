/**
 * ✅ OPTIMIZED SERVER - Production Ready
 * Features:
 * - Clustering (all CPU cores)
 * - In-memory caching (LRU)
 * - Compression
 * - Rate limiting
 * - Async operations
 * - Connection pooling ready
 */

const cluster = require('cluster');
const os = require('os');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const { LRUCache } = require('lru-cache');

const numCPUs = os.cpus().length;
const PORT = 3002;

// ✅ In-memory LRU Cache (per worker)
const cache = new LRUCache({
  max: 500,           // Max 500 items
  ttl: 1000 * 60 * 5, // 5 minutes TTL
});

// Simple rate limiter (per worker - use Redis for distributed)
const rateLimiter = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

const checkRateLimit = (ip) => {
  const now = Date.now();
  const userLimit = rateLimiter.get(ip);
  
  if (!userLimit) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (now > userLimit.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT - userLimit.count };
};

if (cluster.isMaster) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ OPTIMIZED SERVER (Production Ready)                  ║
║  Master PID: ${process.pid}                                     ║
║  CPU Cores: ${numCPUs}                                            ║
║                                                           ║
║  Features:                                                ║
║  ✅ Clustering (${numCPUs} workers)                              ║
║  ✅ In-memory LRU Cache                                   ║
║  ✅ Compression (gzip)                                    ║
║  ✅ Rate Limiting                                         ║
║  ✅ Security Headers (helmet)                             ║
╚═══════════════════════════════════════════════════════════╝
  `);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️  Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });

} else {
  const app = express();
  
  // ✅ Security headers
  app.use(helmet());
  
  // ✅ Compression - reduces payload size by ~70%
  app.use(compression());
  
  // ✅ JSON parsing with limit
  app.use(express.json({ limit: '10kb' }));
  
  // ✅ Rate limiting middleware
  app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const { allowed, remaining } = checkRateLimit(ip);
    
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', remaining);
    
    if (!allowed) {
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: '60 seconds' 
      });
    }
    next();
  });

  // Simulated database
  const fakeDB = {
    users: Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      createdAt: new Date().toISOString()
    }))
  };

  // ✅ Async DB simulation
  const dbQuery = (delay = 50) => {
    return new Promise(resolve => setTimeout(resolve, delay));
  };

  // Health check (no caching)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      pid: process.pid,
      workerId: cluster.worker.id,
      cacheSize: cache.size,
      memory: process.memoryUsage().heapUsed
    });
  });

  // ✅ CACHED: Users list
  app.get('/api/users', async (req, res) => {
    const cacheKey = 'users:list';
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[Worker ${cluster.worker.id}] Cache HIT for ${cacheKey}`);
      return res.json({
        ...cached,
        cached: true,
        pid: process.pid,
        workerId: cluster.worker.id
      });
    }
    
    console.log(`[Worker ${cluster.worker.id}] Cache MISS for ${cacheKey}`);
    
    // Simulate DB query
    await dbQuery(50);
    
    const result = {
      success: true,
      count: fakeDB.users.length,
      data: fakeDB.users.slice(0, 10)
    };
    
    // Store in cache
    cache.set(cacheKey, result);
    
    res.json({
      ...result,
      cached: false,
      pid: process.pid,
      workerId: cluster.worker.id
    });
  });

  // ✅ CACHED: Single user
  app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const cacheKey = `user:${id}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    
    await dbQuery(30);
    
    const user = fakeDB.users.find(u => u.id === parseInt(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const result = { success: true, data: user };
    cache.set(cacheKey, result);
    
    res.json({ 
      ...result, 
      cached: false,
      pid: process.pid,
      workerId: cluster.worker.id
    });
  });

  // ✅ Cache stats
  app.get('/api/cache/stats', (req, res) => {
    res.json({
      size: cache.size,
      maxSize: 500,
      ttl: '5 minutes',
      pid: process.pid,
      workerId: cluster.worker.id
    });
  });

  // ✅ Clear cache
  app.delete('/api/cache', (req, res) => {
    cache.clear();
    res.json({ success: true, message: 'Cache cleared' });
  });

  // ✅ Performance stats
  app.get('/api/stats', (req, res) => {
    const memUsage = process.memoryUsage();
    res.json({
      workers: numCPUs,
      currentWorker: cluster.worker.id,
      pid: process.pid,
      memory: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
      },
      uptime: `${Math.round(process.uptime())}s`,
      cacheSize: cache.size
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(`[Worker ${cluster.worker.id}] Error:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Worker ${cluster.worker.id} listening on port ${PORT}`);
  });
}
