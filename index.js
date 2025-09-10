import cluster from "cluster";
import os from "os";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createLogger } from "./src/utils/logger.js";
import { getCpuCores } from "./src/utils/getCPUCores.js"
const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger("Cluster-Manager", {
  enablePerformanceTracking: true,
  enableMemoryTracking: true
});

// Application configuration
const APP_CONFIG = {
  name: "Socket Server Application",
  version: "1.0.0",
  author: "Development Team",
  environment: process.env.NODE_ENV || 'development',
  workers: 1,
  restartDelay: 2000,
  gracefulShutdownTimeout: 30000,
  healthCheckInterval: 30000
};

// Worker management state
const workerState = {
  workers: new Map(),
  restartCount: 0,
  startTime: Date.now(),
  isShuttingDown: false
};

if (cluster.isPrimary) {
  displayStartupBanner();
  await initializeMasterProcess();
} else {
  await initializeWorkerProcess();
}

async function displayStartupBanner() {
  log.banner(`🚀 ${APP_CONFIG.name} v${APP_CONFIG.version}`, "double", "cyan");
  
  log.separator("═", 80);
  log.info(`📋 Environment: ${chalk.bold.yellow(APP_CONFIG.environment.toUpperCase())}`);
  log.info(`🖥️  Platform: ${chalk.bold.green(os.platform())} ${os.arch()}`);
  log.info(`⚡ Node.js: ${chalk.bold.green(process.version)}`);
  log.info(`🔧 CPU Cores: ${chalk.bold.cyan(getCpuCores())}`);
  log.info(`💾 Total Memory: ${chalk.bold.cyan(Math.round(os.totalmem() / 1024 / 1024 / 1024))}GB`);
  log.info(`👥 Workers: ${chalk.bold.magenta(APP_CONFIG.workers)}`);
  log.info(`🆔 Master PID: ${chalk.bold.yellow(process.pid)}`);
  log.separator("═", 80);
}

async function initializeMasterProcess() {
  const masterLogger = createLogger("Master");
  
  masterLogger.info("🎯 Starting cluster master process...");
  
  // Performance tracking
  masterLogger.perf.start("cluster-startup");
  
  // Memory monitoring
  masterLogger.memory.enableLeakDetection(200, 60000); // 200MB threshold, check every minute
  masterLogger.memory.onLeak((data) => {
    masterLogger.warn("🚨 Potential memory leak detected in master process:", data);
  });

  // Initialize workers
  const workerPromises = [];
  for (let i = 0; i < APP_CONFIG.workers; i++) {
    workerPromises.push(createWorker(i + 1));
  }
  
  try {
    await Promise.all(workerPromises);
    const startupTime = masterLogger.perf.end("cluster-startup");
    
    masterLogger.success(`✅ All ${APP_CONFIG.workers} workers started successfully in ${startupTime.duration.toFixed(2)}ms`);
    
    // Display cluster status
    displayClusterStatus();
    
    // Setup health monitoring
    setupHealthMonitoring();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Log system information
    logSystemInfo();
    
  } catch (error) {
    masterLogger.fatal("❌ Failed to start workers:", error);
    process.exit(1);
  }
}

function createWorker(workerNumber) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const worker = cluster.fork({
      WORKER_ID: workerNumber,
      WORKER_START_TIME: startTime
    });
    
    const workerId = worker.id;
    const workerPid = worker.process.pid;
    
    // Store worker information
    workerState.workers.set(workerId, {
      id: workerId,
      pid: workerPid,
      number: workerNumber,
      startTime,
      restarts: 0,
      status: 'starting',
      lastHealthCheck: null,
      memoryUsage: null
    });

    log.info(`🔄 Starting worker ${workerNumber} (ID: ${workerId}, PID: ${workerPid})`);

    // Worker startup timeout
    const startupTimeout = setTimeout(() => {
      log.error(`⏰ Worker ${workerNumber} startup timeout`);
      worker.kill('SIGKILL');
      reject(new Error(`Worker ${workerNumber} startup timeout`));
    }, 30000);

    worker.once('online', () => {
      clearTimeout(startupTimeout);
      const worker = workerState.workers.get(workerId);
      worker.status = 'online';
      
      const startupDuration = Date.now() - startTime;
      log.success(`✅ Worker ${workerNumber} online (PID: ${workerPid}) - ${startupDuration}ms`);
      resolve(worker);
    });

    worker.on('message', (message) => {
      handleWorkerMessage(workerId, message);
    });

    worker.on('exit', (code, signal) => {
      clearTimeout(startupTimeout);
      handleWorkerExit(workerId, code, signal);
    });

    worker.on('error', (error) => {
      log.error(`❌ Worker ${workerNumber} error:`, error);
    });
  });
}

function handleWorkerMessage(workerId, message) {
  const worker = workerState.workers.get(workerId);
  if (!worker) return;

  switch (message.type) {
    case 'health':
      worker.lastHealthCheck = Date.now();
      worker.memoryUsage = message.memory;
      worker.status = 'healthy';
      break;
      
    case 'ready':
      worker.status = 'ready';
      log.success(`🎉 Worker ${worker.number} is ready to accept connections`);
      break;
      
    case 'error':
      log.error(`❌ Worker ${worker.number} reported error:`, message.error);
      break;
      
    case 'performance':
      log.info(`📊 Worker ${worker.number} performance:`, message.metrics);
      break;
  }
}

function handleWorkerExit(workerId, code, signal) {
  const worker = workerState.workers.get(workerId);
  if (!worker) return;

  const uptime = Date.now() - worker.startTime;
  const uptimeFormatted = formatDuration(uptime);

  if (code === 0) {
    log.info(`👋 Worker ${worker.number} exited gracefully (uptime: ${uptimeFormatted})`);
  } else {
    log.error(`💥 Worker ${worker.number} died (code: ${code}, signal: ${signal}, uptime: ${uptimeFormatted})`);
  }

  workerState.workers.delete(workerId);

  // Restart worker if not shutting down
  if (!workerState.isShuttingDown) {
    worker.restarts++;
    workerState.restartCount++;
    
    if (worker.restarts > 5) {
      log.fatal(`🚨 Worker ${worker.number} has restarted ${worker.restarts} times. Stopping restart attempts.`);
      return;
    }

    log.info(`🔄 Restarting worker ${worker.number} in ${APP_CONFIG.restartDelay}ms... (attempt ${worker.restarts})`);
    
    setTimeout(() => {
      createWorker(worker.number).catch((error) => {
        log.error(`❌ Failed to restart worker ${worker.number}:`, error);
      });
    }, APP_CONFIG.restartDelay);
  }
}

function displayClusterStatus() {
  log.separator("─", 60);
  log.banner("📊 CLUSTER STATUS", "single", "green");
  
  const tableData = [];
  for (const [id, worker] of workerState.workers) {
    tableData.push({
      'Worker #': worker.number,
      'ID': id,
      'PID': worker.pid,
      'Status': worker.status,
      'Uptime': formatDuration(Date.now() - worker.startTime),
      'Restarts': worker.restarts
    });
  }
  
  log.table(tableData);
  log.separator("─", 60);
}

function setupHealthMonitoring() {
  const healthLogger = createLogger("Health-Monitor");
  
  setInterval(() => {
    const now = Date.now();
    const unhealthyWorkers = [];
    
    for (const [id, worker] of workerState.workers) {
      if (worker.lastHealthCheck && (now - worker.lastHealthCheck) > 60000) {
        unhealthyWorkers.push(worker);
      }
    }
    
    if (unhealthyWorkers.length > 0) {
      healthLogger.warn(`⚠️ ${unhealthyWorkers.length} workers are not responding to health checks`);
    }
    
    // Log cluster health summary
    healthLogger.trace("💓 Cluster health check:", {
      totalWorkers: workerState.workers.size,
      healthyWorkers: workerState.workers.size - unhealthyWorkers.length,
      totalRestarts: workerState.restartCount,
      uptime: formatDuration(Date.now() - workerState.startTime)
    });
    
  }, APP_CONFIG.healthCheckInterval);
}

function setupGracefulShutdown() {
  const shutdownLogger = createLogger("Shutdown-Manager");
  
  const gracefulShutdown = (signal) => {
    shutdownLogger.warn(`📤 Received ${signal}, initiating graceful shutdown...`);
    workerState.isShuttingDown = true;
    
    shutdownLogger.perf.start("graceful-shutdown");
    
    // Send shutdown signal to all workers
    const shutdownPromises = [];
    for (const [id, worker] of workerState.workers) {
      shutdownPromises.push(shutdownWorker(id, worker));
    }
    
    // Set timeout for forceful shutdown
    const forceTimeout = setTimeout(() => {
      shutdownLogger.error("⏰ Graceful shutdown timeout, forcing exit");
      process.exit(1);
    }, APP_CONFIG.gracefulShutdownTimeout);
    
    Promise.all(shutdownPromises)
      .then(() => {
        clearTimeout(forceTimeout);
        const shutdownTime = shutdownLogger.perf.end("graceful-shutdown");
        
        shutdownLogger.success(`✅ Graceful shutdown completed in ${shutdownTime.duration.toFixed(2)}ms`);
        shutdownLogger.banner("👋 GOODBYE!", "single", "yellow");
        
        process.exit(0);
      })
      .catch((error) => {
        clearTimeout(forceTimeout);
        shutdownLogger.error("❌ Error during shutdown:", error);
        process.exit(1);
      });
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

function shutdownWorker(workerId, worker) {
  return new Promise((resolve) => {
    const shutdownLogger = createLogger("Shutdown");
    
    shutdownLogger.info(`📤 Shutting down worker ${worker.number} (PID: ${worker.pid})`);
    
    const workerProcess = cluster.workers[workerId];
    if (!workerProcess) {
      resolve();
      return;
    }
    
    // Send graceful shutdown signal
    workerProcess.send({ type: 'shutdown' });
    
    // Wait for worker to exit gracefully
    const gracefulTimeout = setTimeout(() => {
      shutdownLogger.warn(`⏰ Worker ${worker.number} graceful shutdown timeout, forcing kill`);
      workerProcess.kill('SIGKILL');
    }, 10000);
    
    workerProcess.once('exit', () => {
      clearTimeout(gracefulTimeout);
      shutdownLogger.info(`✅ Worker ${worker.number} shutdown complete`);
      resolve();
    });
    
    // Force kill after timeout
    setTimeout(() => {
      if (!workerProcess.isDead()) {
        workerProcess.kill('SIGTERM');
      }
    }, 5000);
  });
}

function logSystemInfo() {
  const sysLogger = createLogger("System-Info");
}

async function initializeWorkerProcess() {
  const workerId = process.env.WORKER_ID;
  const startTime = parseInt(process.env.WORKER_START_TIME);
  const workerLogger = createLogger(`Worker-${workerId}`, {
    enablePerformanceTracking: true
  });

  workerLogger.banner(`🔧 WORKER ${workerId} STARTING`, "single", "blue");
  
  // Setup worker performance tracking
  workerLogger.perf.start("worker-initialization");
  
  // Setup worker health reporting
  setupWorkerHealth(workerLogger);
  
  // Setup worker shutdown handling
  setupWorkerShutdown(workerLogger);

  try {
    // Import and start the main application
    const { startSocket } = await import(join(__dirname, "main.js"));
    
    workerLogger.info("📦 Main module loaded, starting socket server...");
    
    await startSocket();
    
    const initTime = workerLogger.perf.end("worker-initialization");
    
    workerLogger.success(`✅ Socket server started successfully in ${initTime.duration.toFixed(2)}ms`);
    workerLogger.success(`🎯 Worker ${workerId} is ready to handle requests`);
    
    // Notify master that worker is ready
    if (process.send) {
      process.send({
        type: 'ready',
        workerId,
        startupTime: initTime.duration,
        pid: process.pid
      });
    }
    
    workerLogger.separator("─", 60);
    workerLogger.info(`🚀 Worker ${workerId} fully operational`);
    workerLogger.info(`📊 Memory usage: ${workerLogger.memory.usage().heapUsed}MB`);
    workerLogger.separator("─", 60);
    
  } catch (error) {
    workerLogger.fatal(`❌ Failed to start worker ${workerId}:`, error);
    
    if (process.send) {
      process.send({
        type: 'error',
        workerId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
    }
    
    process.exit(1);
  }
}

function setupWorkerHealth(logger) {
  // Send health status to master every 30 seconds
  setInterval(() => {
    if (process.send) {
      const memoryUsage = logger.memory.usage();
      
      process.send({
        type: 'health',
        workerId: process.env.WORKER_ID,
        pid: process.pid,
        memory: memoryUsage,
        uptime: Date.now() - parseInt(process.env.WORKER_START_TIME),
        timestamp: Date.now()
      });
    }
  }, 30000);
}

function setupWorkerShutdown(logger) {
  const handleShutdown = (signal) => {
    logger.warn(`📤 Worker ${process.env.WORKER_ID} received ${signal}, shutting down...`);
    
    // Perform cleanup
    logger.info("🧹 Performing cleanup...");
    
    // Close any open connections, databases, etc.
    // Add your cleanup code here
    
    logger.info("✅ Cleanup completed");
    logger.banner("👋 WORKER SHUTDOWN", "single", "yellow");
    
    process.exit(0);
  };

  // Listen for shutdown messages from master
  process.on('message', (message) => {
    if (message.type === 'shutdown') {
      handleShutdown('MASTER_SHUTDOWN');
    }
  });

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}