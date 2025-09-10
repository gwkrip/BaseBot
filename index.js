import cluster from "cluster";
import os from "os";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createLogger } from "./src/utils/logger.js";
import { getCpuCores } from "./src/utils/getCPUCores.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger("Cluster");

const APP_CONFIG = {
  workers: 1,
  restartDelay: 2000
};

const workerState = {
  workers: new Map(),
  restartCount: 0,
  isShuttingDown: false
};

if (cluster.isPrimary) {
  log.info(`🖥️ OS: ${chalk.green(os.type())} ${chalk.yellow(os.release())} (${os.arch()})`);
  log.info(`⚡ Node.js: ${chalk.cyan(process.version)}`);
  log.info(`🔧 CPU: ${chalk.magenta(getCpuCores() + " cores")}`);
  log.info(`💾 RAM: ${chalk.blue(Math.round(os.totalmem() / 1024 / 1024 / 1024) + "GB")}`);
  log.info("🚀 Start");
  createWorker(1);
} else {
  await initializeWorkerProcess();
}

function createWorker(workerNumber) {
  const worker = cluster.fork({ WORKER_ID: workerNumber });
  workerState.workers.set(worker.id, { id: worker.id, number: workerNumber });
  worker.on("exit", () => {
    if (!workerState.isShuttingDown) {
      setTimeout(() => createWorker(workerNumber), APP_CONFIG.restartDelay);
    }
  });
}

async function initializeWorkerProcess() {
  const workerId = process.env.WORKER_ID;
  const workerLogger = createLogger(`Worker-${workerId}`);
  try {
    const { startSocket } = await import(join(__dirname, "main.js"));
    await startSocket();
    workerLogger.info(`✅ Worker ${workerId} ready`);
  } catch (err) {
    workerLogger.error(`❌ Worker ${workerId} failed:`, err);
    process.exit(1);
  }
}