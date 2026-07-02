import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// ============================================
// 1. CONFIGURATION - Service Registry
// ============================================
interface ServiceConfig {
  target: string;
  pathRewrite?: Record<string, string>;
  auth: boolean;
  rateLimit?: { windowMs: number; max: number };
}

const services: Record<string, ServiceConfig> = {
  '/api/users': {
    target: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    auth: false, // Public endpoints
  },
  '/api/orders': {
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:3002',
    auth: true, // Protected endpoints
    rateLimit: { windowMs: 60000, max: 50 },
  },
  '/api/products': {
    target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003',
    auth: false,
  },
};

// ============================================
// 2. CIRCUIT BREAKER - Fault Tolerance
// ============================================
class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailure: Map<string, number> = new Map();
  private readonly threshold = 5;
  private readonly timeout = 30000; // 30 seconds

  isOpen(service: string): boolean {
    const failures = this.failures.get(service) || 0;
    const lastFail = this.lastFailure.get(service) || 0;

    if (failures >= this.threshold) {
      if (Date.now() - lastFail > this.timeout) {
        this.reset(service); // Try again after timeout
        return false;
      }
      return true; // Circuit is open
    }
    return false;
  }

  recordFailure(service: string): void {
    const current = this.failures.get(service) || 0;
    this.failures.set(service, current + 1);
    this.lastFailure.set(service, Date.now());
    console.log(`[Circuit Breaker] ${service} failures: ${current + 1}`);
  }

  reset(service: string): void {
    this.failures.set(service, 0);
    console.log(`[Circuit Breaker] ${service} reset`);
  }
}

const circuitBreaker = new CircuitBreaker();

// ============================================
// 3. SIMPLE IN-MEMORY CACHE
// ============================================
class SimpleCache {
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key: string, data: any, ttlMs: number = 60000): void {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }
}

const cache = new SimpleCache();

// ============================================
// 4. MIDDLEWARE - Logging
// ============================================
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  req.headers['x-request-id'] = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
    }));
  });

  next();
};

// ============================================
// 5. MIDDLEWARE - Rate Limiting
// ============================================
const createRateLimiter = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: 'Too many requests', retryAfter: windowMs / 1000 },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

const globalLimiter = createRateLimiter(60 * 1000, 100);

// ============================================
// 6. MIDDLEWARE - Authentication
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // Forward user info to downstream services via headers
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// 7. MIDDLEWARE - Circuit Breaker Check
// ============================================
const circuitBreakerMiddleware = (servicePath: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (circuitBreaker.isOpen(servicePath)) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        service: servicePath,
        retryAfter: 30,
      });
    }
    next();
  };
};

// ============================================
// 8. APPLY MIDDLEWARE & SETUP ROUTES
// ============================================
app.use(requestLogger);
app.use(globalLimiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Auth endpoint - Generate JWT for testing
app.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  // In real app, validate against user service
  if (email && password) {
    const token = jwt.sign(
      { userId: '123', email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    return res.json({ token, expiresIn: 3600 });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// Setup proxy routes for each service
Object.entries(services).forEach(([path, config]) => {
  const middlewares: any[] = [];

  // Add circuit breaker check
  middlewares.push(circuitBreakerMiddleware(path));

  // Add service-specific rate limiter
  if (config.rateLimit) {
    middlewares.push(createRateLimiter(config.rateLimit.windowMs, config.rateLimit.max));
  }

  // Add authentication if required
  if (config.auth) {
    middlewares.push(authenticate);
  }

  // Proxy options
  const proxyOptions: Options = {
    target: config.target,
    changeOrigin: true,
    pathRewrite: { [`^${path}`]: '' },
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        // Forward request ID
        const requestId = req.headers['x-request-id'];
        if (requestId) {
          proxyReq.setHeader('x-request-id', requestId);
        }
      },
      proxyRes: (proxyRes: any) => {
        // Reset circuit breaker on success
        if (proxyRes.statusCode && proxyRes.statusCode < 500) {
          circuitBreaker.reset(path);
        }
      },
      error: (err: any, _req: any, res: any) => {
        circuitBreaker.recordFailure(path);
        console.error(`[Proxy Error] ${path}:`, err.message);
        res.status(502).json({
          error: 'Bad Gateway',
          service: path,
          message: 'Unable to reach upstream service',
        });
      },
    },
  };

  // Apply middlewares and proxy
  app.use(path, ...middlewares, createProxyMiddleware(proxyOptions));
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Gateway Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// 9. START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║         API Gateway Started               ║
╠═══════════════════════════════════════════╣
║  Port: ${PORT}                              ║
║  Routes:                                  ║
${Object.entries(services).map(([path, cfg]) =>
    `║    ${path.padEnd(20)} → ${cfg.target.padEnd(10)} ${cfg.auth ? '🔒' : '🔓'}  ║`
  ).join('\n')}
╚═══════════════════════════════════════════╝
  `);
});
