/**
 * PM2 Ecosystem Configuration
 * Start: pm2 start ecosystem.config.js
 * Monitor: pm2 monit
 * Logs: pm2 logs
 * Stop: pm2 delete all
 */

module.exports = {
  apps: [
    {
      name: 'api-basic',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      }
    },
    {
      name: 'api-cluster',
      script: 'src/server-cluster.js',
      instances: 1, // The script handles clustering internally
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'api-optimized',
      script: 'src/server-optimized.js',
      instances: 1, // The script handles clustering internally
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        UV_THREADPOOL_SIZE: 16
      }
    },
    // Alternative: Let PM2 handle clustering
    {
      name: 'api-pm2-cluster',
      script: 'src/server.js',
      instances: 'max',  // Use all CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      }
    }
  ]
};
