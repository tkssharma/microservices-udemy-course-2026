# 🚀 API Performance Demo

Handle millions of requests in Node.js/Express

## Quick Start

```bash
# Install dependencies
npm install

# Run servers (in separate terminals)
npm start              # Basic server (port 3000)
npm run start:cluster  # Cluster server (port 3001)
npm run start:optimized # Optimized server (port 3002)

# Run benchmark
npm run benchmark
```

## Servers

| Server | Port | Features |
|--------|------|----------|
| Basic | 3000 | ❌ Single process, no cache, no optimizations |
| Cluster | 3001 | ✅ Uses all CPU cores |
| Optimized | 3002 | ✅ Clustering + Cache + Compression + Rate Limit |

## Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Get users (compare response times!)
curl http://localhost:3000/api/users  # Basic
curl http://localhost:3001/api/users  # Cluster
curl http://localhost:3002/api/users  # Optimized (cached)

# Get single user
curl http://localhost:3002/api/users/1

# Cache stats
curl http://localhost:3002/api/cache/stats

# Performance stats
curl http://localhost:3002/api/stats
```

## Benchmarking

### Using built-in script:
```bash
npm run benchmark
```

### Using autocannon (recommended):
```bash
# Install autocannon globally
npm i -g autocannon

# Test basic server
autocannon -c 100 -d 10 http://localhost:3000/api/users

# Test optimized server
autocannon -c 100 -d 10 http://localhost:3002/api/users
```

### Using wrk:
```bash
wrk -t4 -c100 -d10s http://localhost:3000/api/users
wrk -t4 -c100 -d10s http://localhost:3002/api/users
```

## Expected Results

| Configuration | Requests/Second | Improvement |
|--------------|-----------------|-------------|
| Single Process | ~1,000 | Baseline |
| Cluster (8 cores) | ~8,000 | 8x |
| + Caching | ~25,000 | 25x |
| + Compression | ~30,000 | 30x |

## PM2 Usage

```bash
# Start all servers with PM2
npm run start:pm2

# Monitor
pm2 monit

# Logs
pm2 logs

# Stop all
npm run stop:pm2
```

## Key Optimizations

1. **Clustering** - Uses all CPU cores
2. **In-Memory Cache** - LRU cache for hot data
3. **Compression** - Gzip reduces payload ~70%
4. **Rate Limiting** - Protects from abuse
5. **Helmet** - Security headers
6. **JSON Limit** - Prevents large payload attacks

## File Structure

```
demo/
├── src/
│   ├── server.js           # ❌ Basic (slow)
│   ├── server-cluster.js   # ✅ Clustering
│   └── server-optimized.js # ✅ Full optimization
├── benchmark/
│   └── load-test.js        # Performance test
├── ecosystem.config.js     # PM2 config
├── package.json
└── README.md
```
