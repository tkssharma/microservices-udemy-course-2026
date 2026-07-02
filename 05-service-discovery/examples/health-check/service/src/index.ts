import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const startTime = Date.now();
let isReady = false;

// Simulate startup initialization
setTimeout(() => {
  isReady = true;
  console.log('Service is ready');
}, 5000);

// Liveness probe - is the service running?
app.get('/health/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

// Readiness probe - can the service handle requests?
app.get('/health/ready', (_req: Request, res: Response) => {
  if (isReady) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready', message: 'Initializing...' });
  }
});

// Combined health check with dependencies
app.get('/health', async (_req: Request, res: Response) => {
  const checks = {
    status: isReady ? 'healthy' : 'unhealthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      cache: await checkCache(),
    },
  };

  const allHealthy = checks.checks.database && checks.checks.cache && isReady;
  res.status(allHealthy ? 200 : 503).json(checks);
});

async function checkDatabase(): Promise<boolean> {
  // Simulate DB check
  return true;
}

async function checkCache(): Promise<boolean> {
  // Simulate cache check
  return true;
}

app.get('/api/data', (_req: Request, res: Response) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Service not ready' });
  }
  res.json({ message: 'Hello from healthy service!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
  console.log('Endpoints: /health, /health/live, /health/ready');
});
