/**
 * Simple Load Test Script
 * Compare performance between basic and optimized servers
 * 
 * For better testing, install autocannon: npm i -g autocannon
 * Then run: autocannon -c 100 -d 10 http://localhost:3000/api/users
 */

const http = require('http');

const SERVERS = [
  { name: 'Basic (No Opt)', url: 'http://localhost:3000/api/users' },
  { name: 'Cluster', url: 'http://localhost:3001/api/users' },
  { name: 'Optimized', url: 'http://localhost:3002/api/users' },
];

const CONCURRENT = 50;
const TOTAL_REQUESTS = 500;

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          duration: Date.now() - start
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function runBatch(url, count) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(makeRequest(url).catch(e => ({ error: true, duration: 5000 })));
  }
  return Promise.all(promises);
}

async function benchmark(server) {
  console.log(`\n📊 Testing: ${server.name}`);
  console.log(`   URL: ${server.url}`);
  console.log(`   Requests: ${TOTAL_REQUESTS} (${CONCURRENT} concurrent)`);
  
  const results = [];
  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENT);
  const start = Date.now();
  
  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(CONCURRENT, TOTAL_REQUESTS - (i * CONCURRENT));
    const batchResults = await runBatch(server.url, batchSize);
    results.push(...batchResults);
    process.stdout.write(`   Progress: ${results.length}/${TOTAL_REQUESTS}\r`);
  }
  
  const totalTime = Date.now() - start;
  const successful = results.filter(r => !r.error);
  const errors = results.filter(r => r.error);
  const durations = successful.map(r => r.duration).sort((a, b) => a - b);
  
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];
  const rps = (successful.length / (totalTime / 1000)).toFixed(2);
  
  console.log(`\n   ✅ Results:`);
  console.log(`   ├─ Total Time: ${totalTime}ms`);
  console.log(`   ├─ Successful: ${successful.length}/${TOTAL_REQUESTS}`);
  console.log(`   ├─ Errors: ${errors.length}`);
  console.log(`   ├─ Requests/sec: ${rps}`);
  console.log(`   ├─ Avg Latency: ${avg.toFixed(2)}ms`);
  console.log(`   ├─ P50: ${p50}ms`);
  console.log(`   ├─ P95: ${p95}ms`);
  console.log(`   └─ P99: ${p99}ms`);
  
  return { name: server.name, rps: parseFloat(rps), avg, p99 };
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 API Performance Benchmark                             ║
║                                                           ║
║  Make sure all servers are running:                       ║
║  - Basic:     node src/server.js          (port 3000)     ║
║  - Cluster:   node src/server-cluster.js  (port 3001)     ║
║  - Optimized: node src/server-optimized.js (port 3002)    ║
╚═══════════════════════════════════════════════════════════╝
  `);

  const results = [];
  
  for (const server of SERVERS) {
    try {
      const result = await benchmark(server);
      results.push(result);
    } catch (e) {
      console.log(`   ❌ Server not available: ${server.url}`);
    }
  }

  if (results.length > 0) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📈 COMPARISON SUMMARY`);
    console.log(`${'═'.repeat(60)}`);
    
    const baseline = results[0];
    results.forEach(r => {
      const improvement = ((r.rps / baseline.rps - 1) * 100).toFixed(0);
      const bar = '█'.repeat(Math.ceil(r.rps / 10));
      console.log(`${r.name.padEnd(20)} ${r.rps.toString().padStart(8)} req/s ${improvement > 0 ? `(+${improvement}%)` : ''}`);
      console.log(`                     ${bar}`);
    });
  }
}

main().catch(console.error);
