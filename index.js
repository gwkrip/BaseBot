import cluster from "cluster";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createLogger } from "./src/utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger("Cluster");

if (cluster.isPrimary) {
  log.info(`Master ${process.pid} is running`);

  const startWorker = () => {
    const worker = cluster.fork();
    log.success(`Worker ${worker.process.pid} started`);

    worker.on("exit", (code, signal) => {
      log.error(
        `Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`
      );
      startWorker();
    });
  };

  startWorker();

  const shutdown = () => {
    log.warn("Master shutting down...");
    for (const id in cluster.workers) {
      cluster.workers[id].kill("SIGTERM");
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} else {
  const workerLog = createLogger(`Worker-${process.pid}`);

  import(join(__dirname, "main.js"))
    .then(({ startSocket }) => startSocket())
    .then(() => workerLog.success("Socket started successfully"))
    .catch((err) => {
      workerLog.error("Failed to start main.js:", err);
      process.exit(1);
    });
}