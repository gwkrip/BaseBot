import chalk from "chalk";
import dayjs from "dayjs";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { createWriteStream, createReadStream } from "fs";
import { EventEmitter } from "events";
import { performance } from "perf_hooks";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { promisify } from "util";
import zlib from "zlib";
import os from "os";

/**
 * Professional Logging Library
 * Enterprise-grade logging solution with advanced features
 * @version 2.0.0
 * @author Professional Development Team
 */

// Type definitions and interfaces (JSDoc style for better IDE support)

/**
 * @typedef {Object} LogLevel
 * @property {number} value - Numeric value for level comparison
 * @property {string} name - Display name
 * @property {boolean} fatal - Whether this level should terminate the process
 */

/**
 * @typedef {Object} LoggerConfig
 * @property {string} dateFormat - Date format for timestamps
 * @property {string} fileFormat - File naming format
 * @property {string} encoding - File encoding
 * @property {number} maxFileSize - Maximum file size in bytes
 * @property {number} maxFiles - Maximum number of log files to keep
 * @property {boolean} compressionEnabled - Enable log compression
 * @property {boolean} asyncMode - Enable asynchronous logging
 * @property {number} bufferSize - Buffer size for async logging
 * @property {number} flushInterval - Auto-flush interval in milliseconds
 * @property {Object} levels - Log levels configuration
 * @property {string[]} transports - Available transport methods
 * @property {Function[]} middleware - Middleware functions
 * @property {Object} filters - Log filtering configuration
 */

// Constants and Configuration
const LOG_CONFIG = Object.freeze({
  dateFormat: "YYYY-MM-DD HH:mm:ss.SSS",
  fileFormat: "YYYY-MM-DD",
  encoding: "utf8",
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 30,
  compressionEnabled: true,
  asyncMode: true,
  bufferSize: 1000,
  flushInterval: 5000,
  enablePerformanceTracking: true,
  enableMemoryTracking: true,
  enableSourceTracking: true,
  enableStructuredLogging: true,
  enableLogAggregation: true,
  enableMetrics: true,
  
  levels: Object.freeze({
    TRACE: { value: 0, name: 'TRACE', fatal: false },
    DEBUG: { value: 10, name: 'DEBUG', fatal: false },
    INFO: { value: 20, name: 'INFO', fatal: false },
    SUCCESS: { value: 25, name: 'SUCCESS', fatal: false },
    WARN: { value: 30, name: 'WARN', fatal: false },
    ERROR: { value: 40, name: 'ERROR', fatal: false },
    FATAL: { value: 50, name: 'FATAL', fatal: true },
    CMD: { value: 35, name: 'CMD', fatal: false },
    SECURITY: { value: 45, name: 'SECURITY', fatal: false },
    AUDIT: { value: 60, name: 'AUDIT', fatal: false }
  }),
  
  transports: ['console', 'file', 'json', 'stream', 'webhook'],
  formatters: ['pretty', 'json', 'compact', 'structured'],
  
  filters: {
    level: null,
    module: [],
    pattern: null,
    custom: []
  },
  
  middleware: [],
  
  compression: {
    algorithm: 'gzip',
    level: 6
  },
  
  rotation: {
    strategy: 'size', // 'size', 'time', 'hybrid'
    interval: 'daily',
    preserveStructure: true
  },
  
  performance: {
    trackAllMethods: false,
    slowThreshold: 1000, // ms
    memoryThreshold: 100 // MB
  }
});

// Enhanced styling with better accessibility
const LOG_STYLES = Object.freeze({
  trace: {
    icon: "🔍",
    color: chalk.dim.gray,
    bgColor: chalk.bgGray.white.bold,
    prefix: "TRACE",
    emoji: "🔎",
    priority: 0
  },
  debug: {
    icon: "🐛",
    color: chalk.bold.magenta,
    bgColor: chalk.bgMagenta.white.bold,
    prefix: "DEBUG",
    emoji: "🔧",
    priority: 1
  },
  info: {
    icon: "ℹ️",
    color: chalk.bold.cyan,
    bgColor: chalk.bgCyan.black.bold,
    prefix: "INFO",
    emoji: "💡",
    priority: 2
  },
  success: {
    icon: "✅",
    color: chalk.bold.green,
    bgColor: chalk.bgGreen.black.bold,
    prefix: "SUCCESS",
    emoji: "🎉",
    priority: 3
  },
  warn: {
    icon: "⚠️",
    color: chalk.bold.yellow,
    bgColor: chalk.bgYellow.black.bold,
    prefix: "WARNING",
    emoji: "🚨",
    priority: 4
  },
  error: {
    icon: "❌",
    color: chalk.bold.red,
    bgColor: chalk.bgRed.white.bold,
    prefix: "ERROR",
    emoji: "💥",
    priority: 5
  },
  fatal: {
    icon: "💀",
    color: chalk.bold.red.inverse,
    bgColor: chalk.bgRed.white.bold,
    prefix: "FATAL",
    emoji: "☠️",
    priority: 6
  },
  cmd: {
    icon: "⚡",
    color: chalk.bold.white,
    bgColor: chalk.bgBlue.white.bold,
    prefix: "CMD",
    emoji: "🖥️",
    priority: 4
  },
  security: {
    icon: "🔒",
    color: chalk.bold.red,
    bgColor: chalk.bgRed.yellow.bold,
    prefix: "SECURITY",
    emoji: "🛡️",
    priority: 6
  },
  audit: {
    icon: "📊",
    color: chalk.bold.blue,
    bgColor: chalk.bgBlue.white.bold,
    prefix: "AUDIT",
    emoji: "📈",
    priority: 7
  }
});

/**
 * Advanced Performance Tracking System
 * Tracks method execution times, memory usage, and system metrics
 */
class PerformanceTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.timers = new Map();
    this.metrics = new Map();
    this.systemMetrics = new Map();
    this.options = { ...LOG_CONFIG.performance, ...options };
    this.startTime = Date.now();
    
    this.setupSystemMonitoring();
  }

  setupSystemMonitoring() {
    if (this.options.trackSystemMetrics) {
      setInterval(() => {
        this.collectSystemMetrics();
      }, 30000); // Every 30 seconds
    }
  }

  collectSystemMetrics() {
    const metrics = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      system: {
        loadavg: os.loadavg(),
        freemem: os.freemem(),
        totalmem: os.totalmem()
      }
    };
    
    this.systemMetrics.set(Date.now(), metrics);
    this.emit('systemMetrics', metrics);
    
    // Clean old metrics (keep last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [timestamp] of this.systemMetrics) {
      if (timestamp < oneHourAgo) {
        this.systemMetrics.delete(timestamp);
      }
    }
  }

  start(label, metadata = {}) {
    const startData = {
      timestamp: performance.now(),
      hrTime: process.hrtime.bigint(),
      memory: process.memoryUsage(),
      metadata
    };
    
    this.timers.set(label, startData);
    this.emit('timerStart', { label, ...startData });
    return label;
  }

  end(label) {
    const startData = this.timers.get(label);
    if (!startData) {
      throw new Error(`Timer '${label}' was not started`);
    }

    const endTime = performance.now();
    const endHrTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = endTime - startData.timestamp;
    const precisionDuration = Number(endHrTime - startData.hrTime) / 1000000; // Convert to ms
    
    const result = {
      label,
      duration,
      precisionDuration,
      memoryDelta: {
        rss: endMemory.rss - startData.memory.rss,
        heapTotal: endMemory.heapTotal - startData.memory.heapTotal,
        heapUsed: endMemory.heapUsed - startData.memory.heapUsed,
        external: endMemory.external - startData.memory.external
      },
      metadata: startData.metadata
    };

    this.timers.delete(label);
    this.updateMetric(label, result);
    this.emit('timerEnd', result);
    
    if (duration > this.options.slowThreshold) {
      this.emit('slowOperation', result);
    }

    return result;
  }

  updateMetric(label, result) {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        durations: [],
        memoryImpact: { total: 0, avg: 0 },
        errors: 0
      });
    }

    const metric = this.metrics.get(label);
    metric.count++;
    metric.totalDuration += result.duration;
    metric.minDuration = Math.min(metric.minDuration, result.duration);
    metric.maxDuration = Math.max(metric.maxDuration, result.duration);
    metric.avgDuration = metric.totalDuration / metric.count;
    
    // Store duration for percentile calculation (keep last 1000)
    metric.durations.push(result.duration);
    if (metric.durations.length > 1000) {
      metric.durations.shift();
    }
    
    // Calculate percentiles
    const sorted = [...metric.durations].sort((a, b) => a - b);
    metric.p95Duration = sorted[Math.floor(sorted.length * 0.95)] || 0;
    metric.p99Duration = sorted[Math.floor(sorted.length * 0.99)] || 0;
    
    // Memory impact
    const memoryChange = result.memoryDelta.heapUsed;
    metric.memoryImpact.total += memoryChange;
    metric.memoryImpact.avg = metric.memoryImpact.total / metric.count;
  }

  getMetrics(label = null) {
    if (label) {
      return this.metrics.get(label) || null;
    }
    return Object.fromEntries(this.metrics);
  }

  getSystemMetrics(duration = 3600000) { // Last hour by default
    const cutoff = Date.now() - duration;
    const recent = new Map();
    
    for (const [timestamp, metrics] of this.systemMetrics) {
      if (timestamp >= cutoff) {
        recent.set(timestamp, metrics);
      }
    }
    
    return Object.fromEntries(recent);
  }

  reset(label = null) {
    if (label) {
      this.metrics.delete(label);
      this.timers.delete(label);
    } else {
      this.metrics.clear();
      this.timers.clear();
    }
  }

  async measure(label, fn, metadata = {}) {
    this.start(label, metadata);
    try {
      const result = await fn();
      return result;
    } catch (error) {
      const metric = this.metrics.get(label);
      if (metric) metric.errors++;
      throw error;
    } finally {
      this.end(label);
    }
  }
}

/**
 * Enhanced Memory Tracking with leak detection
 */
class MemoryTracker extends EventEmitter {
  constructor() {
    super();
    this.snapshots = [];
    this.leakDetectionEnabled = false;
    this.threshold = 100; // MB
    this.interval = null;
  }

  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024 * 100) / 100
    };
  }

  static formatMemoryUsage() {
    const usage = this.getMemoryUsage();
    return `RSS: ${usage.rss}MB | Heap: ${usage.heapUsed}/${usage.heapTotal}MB | External: ${usage.external}MB | ArrayBuffers: ${usage.arrayBuffers}MB`;
  }

  enableLeakDetection(threshold = 100, interval = 60000) {
    this.leakDetectionEnabled = true;
    this.threshold = threshold;
    
    this.interval = setInterval(() => {
      this.checkForLeaks();
    }, interval);
  }

  disableLeakDetection() {
    this.leakDetectionEnabled = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  takeSnapshot(label = null) {
    const snapshot = {
      timestamp: Date.now(),
      label,
      usage: MemoryTracker.getMemoryUsage()
    };
    
    this.snapshots.push(snapshot);
    
    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }
    
    return snapshot;
  }

  checkForLeaks() {
    if (this.snapshots.length < 2) return;
    
    const current = this.takeSnapshot('leak-check');
    const previous = this.snapshots[this.snapshots.length - 2];
    
    const heapGrowth = current.usage.heapUsed - previous.usage.heapUsed;
    
    if (heapGrowth > this.threshold / 10) { // 10% of threshold per check
      this.emit('potentialLeak', {
        growth: heapGrowth,
        current: current.usage,
        previous: previous.usage,
        threshold: this.threshold
      });
    }
  }

  getSnapshots(count = 10) {
    return this.snapshots.slice(-count);
  }

  getMemoryTrend() {
    if (this.snapshots.length < 2) return null;
    
    const recent = this.snapshots.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    return {
      duration: last.timestamp - first.timestamp,
      heapGrowth: last.usage.heapUsed - first.usage.heapUsed,
      rssGrowth: last.usage.rss - first.usage.rss,
      trend: last.usage.heapUsed > first.usage.heapUsed ? 'increasing' : 'decreasing'
    };
  }
}

/**
 * Enhanced Source Code Tracking
 */
class SourceTracker {
  static getCallSite(stackIndex = 4) {
    const originalPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    
    try {
      const stack = new Error().stack;
      if (stack && stack[stackIndex]) {
        const site = stack[stackIndex];
        const fileName = site.getFileName();
        const relativePath = fileName ? path.relative(process.cwd(), fileName) : 'unknown';
        
        return {
          file: path.basename(relativePath),
          path: relativePath,
          line: site.getLineNumber(),
          column: site.getColumnNumber(),
          function: site.getFunctionName() || site.getMethodName() || 'anonymous',
          type: site.getTypeName(),
          isNative: site.isNative(),
          isConstructor: site.isConstructor()
        };
      }
    } catch (error) {
      // Fallback for cases where stack trace is not available
      return {
        file: 'unknown',
        path: 'unknown',
        line: 0,
        column: 0,
        function: 'unknown'
      };
    } finally {
      Error.prepareStackTrace = originalPrepareStackTrace;
    }
    
    return null;
  }

  static getFullStackTrace(limit = 10) {
    const originalPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    
    try {
      const stack = new Error().stack;
      const traces = [];
      
      for (let i = 3; i < Math.min(stack.length, limit + 3); i++) {
        if (stack[i]) {
          const site = stack[i];
          const fileName = site.getFileName();
          const relativePath = fileName ? path.relative(process.cwd(), fileName) : 'unknown';
          
          traces.push({
            file: path.basename(relativePath),
            path: relativePath,
            line: site.getLineNumber(),
            column: site.getColumnNumber(),
            function: site.getFunctionName() || 'anonymous'
          });
        }
      }
      
      return traces;
    } finally {
      Error.prepareStackTrace = originalPrepareStackTrace;
    }
  }
}

/**
 * Advanced Log Buffer with priority queuing
 */
class LogBuffer extends EventEmitter {
  constructor(size = 1000, flushInterval = 5000) {
    super();
    this.buffer = [];
    this.priorityBuffer = []; // High priority logs
    this.maxSize = size;
    this.flushInterval = flushInterval;
    this.flushTimer = null;
    this.isDestroyed = false;
    this.stats = {
      totalLogs: 0,
      flushedLogs: 0,
      droppedLogs: 0
    };
    
    this.setupAutoFlush();
    this.setupGracefulShutdown();
  }

  add(entry, priority = false) {
    if (this.isDestroyed) return false;
    
    const targetBuffer = priority ? this.priorityBuffer : this.buffer;
    targetBuffer.push({
      ...entry,
      id: this.generateLogId(),
      bufferedAt: Date.now()
    });
    
    this.stats.totalLogs++;
    
    // Check if we need to flush
    const totalSize = this.buffer.length + this.priorityBuffer.length;
    if (totalSize >= this.maxSize) {
      if (this.buffer.length > this.maxSize * 0.8) {
        // Drop oldest non-priority logs if buffer is mostly non-priority
        const dropped = this.buffer.shift();
        this.stats.droppedLogs++;
        this.emit('logDropped', dropped);
      }
      this.flush();
    }
    
    return true;
  }

  flush() {
    if (this.isDestroyed || (this.buffer.length === 0 && this.priorityBuffer.length === 0)) {
      return;
    }
    
    // Priority logs first
    const allLogs = [...this.priorityBuffer, ...this.buffer];
    this.emit('flush', allLogs);
    
    this.stats.flushedLogs += allLogs.length;
    this.buffer = [];
    this.priorityBuffer = [];
    
    this.resetTimer();
  }

  setupAutoFlush() {
    this.resetTimer();
  }

  resetTimer() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    
    if (!this.isDestroyed) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      if (!this.isDestroyed) {
        this.flush();
      }
    };
    
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    process.once('exit', shutdown);
  }

  generateLogId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    return {
      ...this.stats,
      currentBufferSize: this.buffer.length + this.priorityBuffer.length,
      bufferUtilization: (this.buffer.length + this.priorityBuffer.length) / this.maxSize
    };
  }

  destroy() {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.flush();
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    this.emit('destroyed');
  }
}

/**
 * Enhanced File Rotation with compression and cleanup
 */
class FileRotator {
  static async rotateFiles(logDir, baseName, maxFiles, options = {}) {
    const {
      compressionEnabled = LOG_CONFIG.compressionEnabled,
      compressionAlgorithm = LOG_CONFIG.compression.algorithm
    } = options;

    try {
      const files = await fs.readdir(logDir);
      const logFiles = files
        .filter(f => f.startsWith(baseName) && (f.endsWith('.log') || f.endsWith('.log.gz')))
        .map(f => ({
          name: f,
          path: path.join(logDir, f),
          stat: null
        }));

      // Get file stats for sorting by modification time
      for (const file of logFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          console.error(`Failed to get stats for ${file.name}:`, error.message);
        }
      }

      // Sort by modification time (newest first)
      const sortedFiles = logFiles
        .filter(f => f.stat)
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      if (sortedFiles.length >= maxFiles) {
        const filesToProcess = sortedFiles.slice(maxFiles - 1);
        
        for (const file of filesToProcess) {
          if (file.name.endsWith('.log') && compressionEnabled) {
            // Compress before removal
            await this.compressFile(file.path, compressionAlgorithm);
          } else if (file.name.endsWith('.log.gz') || !compressionEnabled) {
            // Remove old compressed files or when compression is disabled
            await fs.unlink(file.path);
          }
        }
      }
    } catch (error) {
      console.error('Failed to rotate log files:', error.message);
      throw error;
    }
  }

  static async compressFile(filePath, algorithm = 'gzip') {
    const compressedPath = `${filePath}.gz`;
    
    return new Promise((resolve, reject) => {
      const readStream = createReadStream(filePath);
      const writeStream = createWriteStream(compressedPath);
      const compress = zlib.createGzip({ level: LOG_CONFIG.compression.level });
      
      readStream
        .pipe(compress)
        .pipe(writeStream)
        .on('finish', async () => {
          try {
            await fs.unlink(filePath); // Remove original file
            resolve(compressedPath);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  static async checkFileSize(filePath, maxSize) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size >= maxSize;
    } catch {
      return false;
    }
  }

  static async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  static async cleanupOldLogs(logDir, retentionDays = 30) {
    try {
      const files = await fs.readdir(logDir, { withFileTypes: true });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      for (const file of files) {
        if (file.isFile() && (file.name.endsWith('.log') || file.name.endsWith('.log.gz'))) {
          const filePath = path.join(logDir, file.name);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error.message);
    }
  }
}

/**
 * Initialize log directory with proper structure
 */
async function initializeLogDirectory() {
  const logDir = path.join(process.cwd(), "data", "logs");
  
  try {
    await fs.mkdir(logDir, { recursive: true });
    
    const subDirs = [
      'general',
      'errors', 
      'audit', 
      'performance', 
      'debug',
      'security',
      'archived'
    ];
    
    for (const subDir of subDirs) {
      await fs.mkdir(path.join(logDir, subDir), { recursive: true });
    }
    
    // Create log configuration file
    const configPath = path.join(logDir, 'log-config.json');
    if (!fsSync.existsSync(configPath)) {
      await fs.writeFile(configPath, JSON.stringify({
        createdAt: new Date().toISOString(),
        version: '2.0.0',
        structure: subDirs,
        retention: {
          days: 30,
          maxSize: '1GB'
        }
      }, null, 2));
    }
    
    return logDir;
  } catch (error) {
    console.error(chalk.bold.red("Failed to create log directory:"), error.message);
    throw error;
  }
}

/**
 * Get log file path with intelligent routing
 */
async function getLogFilePath(type = 'general', level = 'info') {
  const logDir = await initializeLogDirectory();
  if (!logDir) return null;
  
  // Route logs to appropriate directories based on type and level
  const routingMap = {
    error: 'errors',
    fatal: 'errors',
    security: 'security',
    audit: 'audit',
    performance: 'performance',
    debug: 'debug',
    trace: 'debug'
  };
  
  const subDir = routingMap[type] || routingMap[level] || 'general';
  const timestamp = dayjs().format(LOG_CONFIG.fileFormat);
  const fileName = `${timestamp}-${type}.log`;
  
  return path.join(logDir, subDir, fileName);
}

/**
 * Utility functions
 */
function getTimestamp() {
  return dayjs().format(LOG_CONFIG.dateFormat);
}

function getProcessInfo() {
  return {
    pid: process.pid,
    ppid: process.ppid,
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: Math.round(process.uptime()),
    cwd: process.cwd(),
    execPath: process.execPath,
    argv: process.argv.slice(2) // Remove node and script path
  };
}

function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    hostname: os.hostname(),
    user: os.userInfo().username,
    tmpdir: os.tmpdir()
  };
}

/**
 * Advanced message formatting with context awareness
 */
function formatLogMessage(level, style, moduleName, args, options = {}) {
  const timestamp = chalk.bold.blue(`[${getTimestamp()}]`);
  const levelBadge = style.bgColor(` ${style.prefix} `);
  const icon = style.color(style.icon);
  const module = chalk.bold.white(`[${moduleName}]`);
  
  let additionalInfo = '';
  
  // Process info for critical levels
  if (['error', 'fatal', 'security'].includes(level)) {
    const info = getProcessInfo();
    additionalInfo += chalk.dim.gray(`[PID:${info.pid}]`);
  }
  
  // Memory info for memory-sensitive levels
  if (LOG_CONFIG.enableMemoryTracking && ['error', 'warn', 'fatal'].includes(level)) {
    additionalInfo += chalk.dim.yellow(`[${MemoryTracker.formatMemoryUsage()}]`);
  }
  
  // Source info when requested
  if (LOG_CONFIG.enableSourceTracking && (options.includeSource || level === 'error' || level === 'fatal')) {
    const source = SourceTracker.getCallSite(5);
    if (source) {
      additionalInfo += chalk.dim.cyan(`[${source.file}:${source.line}:${source.function}]`);
    }
  }
  
  // Request ID for tracing (if available in options)
  if (options.requestId) {
    additionalInfo += chalk.dim.magenta(`[REQ:${options.requestId}]`);
  }
  
  const separator = chalk.gray("•");
  
  // Format message content with enhanced object serialization
  const message = args.map(arg => {
    if (arg instanceof Error) {
      return chalk.red(`${arg.name}: ${arg.message}`);
    }
    if (typeof arg === 'object' && arg !== null) {
      return chalk.gray(JSON.stringify(arg, (key, value) => {
        if (value instanceof Error) {
          return { 
            name: value.name, 
            message: value.message, 
            stack: value.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
          };
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'function') {
          return '[Function]';
        }
        if (Buffer.isBuffer(value)) {
          return `[Buffer ${value.length} bytes]`;
        }
        return value;
      }, 2));
    }
    return chalk.white(String(arg));
  }).join(' ');

  return `${timestamp} ${levelBadge} ${icon} ${module}${additionalInfo} ${separator} ${message}`;
}

/**
 * Enhanced JSON log formatting with structured data
 */
function formatStructuredLog(level, moduleName, args, metadata = {}) {
  const baseLog = {
    '@timestamp': new Date().toISOString(),
    '@version': '1',
    level: level.toUpperCase(),
    logger: moduleName,
    message: args.join(' '),
    
    // Process information
    process: getProcessInfo(),
    
    // Environment information
    environment: getEnvironmentInfo(),
    
    // Custom metadata
    ...metadata
  };

  // Add memory information if enabled
  if (LOG_CONFIG.enableMemoryTracking) {
    baseLog.memory = MemoryTracker.getMemoryUsage();
  }

  // Add source information if enabled
  if (LOG_CONFIG.enableSourceTracking) {
    baseLog.source = SourceTracker.getCallSite(5);
  }

  // Add stack trace for errors
  if (['error', 'fatal'].includes(level)) {
    baseLog.stackTrace = SourceTracker.getFullStackTrace(10);
  }

  // Process arguments for structured logging
  const structuredArgs = args.map(arg => {
    if (arg instanceof Error) {
      return {
        type: 'error',
        name: arg.name,
        message: arg.message,
        stack: arg.stack,
        cause: arg.cause
      };
    }
    if (typeof arg === 'object' && arg !== null) {
      return {
        type: 'object',
        data: arg
      };
    }
    return {
      type: typeof arg,
      value: String(arg)
    };
  });

  if (structuredArgs.length > 0) {
    baseLog.arguments = structuredArgs;
  }

  return JSON.stringify(baseLog);
}

/**
 * Enhanced Log Writer with multiple transports
 */
class LogWriter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = { ...LOG_CONFIG, ...options };
    this.streams = new Map();
    this.buffer = new LogBuffer(this.options.bufferSize, this.options.flushInterval);
    this.isDestroyed = false;
    this.stats = {
      totalWrites: 0,
      failedWrites: 0,
      bytesWritten: 0
    };
    
    this.setupEventHandlers();
    this.setupHealthCheck();
  }

  setupEventHandlers() {
    this.buffer.on('flush', this.handleFlush.bind(this));
    this.buffer.on('logDropped', this.handleDroppedLog.bind(this));
    
    // Handle stream errors
    this.on('streamError', this.handleStreamError.bind(this));
  }

  setupHealthCheck() {
    // Periodic health check every 5 minutes
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  async performHealthCheck() {
    const stats = this.getStats();
    
    if (stats.failedWrites > 100) {
      this.emit('healthWarning', {
        type: 'high_failure_rate',
        stats,
        message: 'High number of failed writes detected'
      });
    }
    
    if (stats.bufferUtilization > 0.8) {
      this.emit('healthWarning', {
        type: 'buffer_pressure',
        stats,
        message: 'Log buffer utilization is high'
      });
    }
  }

  async getStream(filePath) {
    if (this.streams.has(filePath)) {
      return this.streams.get(filePath);
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      const stream = createWriteStream(filePath, { 
        flags: 'a', 
        encoding: this.options.encoding,
        highWaterMark: 64 * 1024 // 64KB buffer
      });

      // Handle stream events
      stream.on('error', (error) => {
        this.emit('streamError', { filePath, error });
        this.streams.delete(filePath);
      });

      stream.on('close', () => {
        this.streams.delete(filePath);
      });

      this.streams.set(filePath, stream);
      return stream;
    } catch (error) {
      this.emit('streamError', { filePath, error });
      throw error;
    }
  }

  async write(content, type = 'general', options = {}) {
    if (this.isDestroyed) return false;

    const entry = {
      content,
      type,
      timestamp: Date.now(),
      options,
      size: Buffer.byteLength(content, 'utf8')
    };

    // Use priority queue for critical logs
    const priority = ['fatal', 'security', 'error'].includes(type);
    return this.buffer.add(entry, priority);
  }

  async writeSync(content, type, options = {}) {
    if (this.isDestroyed) return false;

    const logFile = await getLogFilePath(type, options.level);
    if (!logFile) {
      this.stats.failedWrites++;
      return false;
    }

    try {
      // Check for file rotation
      if (await FileRotator.checkFileSize(logFile, this.options.maxFileSize)) {
        await FileRotator.rotateFiles(
          path.dirname(logFile), 
          path.basename(logFile, '.log'), 
          this.options.maxFiles,
          {
            compressionEnabled: this.options.compressionEnabled,
            compressionAlgorithm: this.options.compression.algorithm
          }
        );
      }

      const cleanContent = this.sanitizeContent(content);
      const stream = await this.getStream(logFile);
      
      return new Promise((resolve, reject) => {
        stream.write(cleanContent + '\n', (error) => {
          if (error) {
            this.stats.failedWrites++;
            reject(error);
          } else {
            this.stats.totalWrites++;
            this.stats.bytesWritten += Buffer.byteLength(cleanContent, 'utf8');
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.stats.failedWrites++;
      this.emit('writeError', { type, error, content: content.substring(0, 100) });
      throw error;
    }
  }

  sanitizeContent(content) {
    // Remove ANSI color codes for file output
    return content.replace(/\x1b\[[0-9;]*m/g, '');
  }

  async handleFlush(entries) {
    if (this.isDestroyed || entries.length === 0) return;

    // Group entries by type for efficient batch writing
    const groupedEntries = entries.reduce((acc, entry) => {
      if (!acc[entry.type]) acc[entry.type] = [];
      acc[entry.type].push(entry);
      return acc;
    }, {});

    const writePromises = [];

    for (const [type, typeEntries] of Object.entries(groupedEntries)) {
      const promise = this.writeBatch(type, typeEntries);
      writePromises.push(promise);
    }

    try {
      await Promise.allSettled(writePromises);
    } catch (error) {
      this.emit('flushError', { error, entriesCount: entries.length });
    }
  }

  async writeBatch(type, entries) {
    const logFile = await getLogFilePath(type);
    if (!logFile) return;

    try {
      const stream = await this.getStream(logFile);
      const batchContent = entries
        .map(entry => this.sanitizeContent(entry.content))
        .join('\n') + '\n';

      return new Promise((resolve, reject) => {
        stream.write(batchContent, (error) => {
          if (error) {
            this.stats.failedWrites += entries.length;
            reject(error);
          } else {
            this.stats.totalWrites += entries.length;
            this.stats.bytesWritten += Buffer.byteLength(batchContent, 'utf8');
            resolve();
          }
        });
      });
    } catch (error) {
      this.stats.failedWrites += entries.length;
      this.emit('batchWriteError', { type, error, entriesCount: entries.length });
      throw error;
    }
  }

  handleDroppedLog(log) {
    // Log dropped entries to a separate emergency file
    console.warn(chalk.yellow('⚠️ Log entry dropped due to buffer overflow'));
    this.emit('logDropped', log);
  }

  handleStreamError({ filePath, error }) {
    console.error(chalk.red(`❌ Stream error for ${filePath}:`), error.message);
    
    // Try to recreate the stream after a delay
    setTimeout(async () => {
      if (!this.isDestroyed) {
        try {
          await this.getStream(filePath);
        } catch (retryError) {
          this.emit('streamRecreationFailed', { filePath, error: retryError });
        }
      }
    }, 5000);
  }

  getStats() {
    return {
      ...this.stats,
      bufferStats: this.buffer.getStats(),
      activeStreams: this.streams.size,
      isDestroyed: this.isDestroyed
    };
  }

  async flush() {
    return new Promise((resolve) => {
      this.buffer.flush();
      // Wait a bit for async writes to complete
      setTimeout(resolve, 100);
    });
  }

  async destroy() {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Flush remaining logs
    await this.flush();
    
    // Close all streams
    const closePromises = Array.from(this.streams.values()).map(stream => {
      return new Promise((resolve) => {
        stream.end(() => resolve());
      });
    });
    
    await Promise.all(closePromises);
    this.streams.clear();
    
    // Destroy buffer
    this.buffer.destroy();
    
    this.emit('destroyed');
  }
}

// Global log writer instance
const logWriter = new LogWriter();

/**
 * Enhanced Logger Factory with middleware support
 */
function createLogger(moduleName = "Application", options = {}) {
  const performanceTracker = new PerformanceTracker(options.performance);
  const memoryTracker = new MemoryTracker();
  const loggerOptions = { ...LOG_CONFIG, ...options };
  
  // Setup memory leak detection if enabled
  if (loggerOptions.enableMemoryTracking) {
    memoryTracker.enableLeakDetection();
    memoryTracker.on('potentialLeak', (data) => {
      logger.warn('Potential memory leak detected:', data);
    });
  }

  const logger = {
    // Core logging methods
    trace: (...args) => {
      if (!shouldLog('trace', moduleName)) return;
      
      const formatted = formatLogMessage('trace', LOG_STYLES.trace, moduleName, args, { includeSource: true });
      console.log(formatted);
      logWriter.write(formatted, 'debug');
    },

    debug: (...args) => {
      if (!shouldLog('debug', moduleName)) return;
      
      const formatted = formatLogMessage('debug', LOG_STYLES.debug, moduleName, args, { includeSource: true });
      console.log(formatted);
      logWriter.write(formatted, 'debug');
    },

    info: (...args) => {
      if (!shouldLog('info', moduleName)) return;
      
      const formatted = formatLogMessage('info', LOG_STYLES.info, moduleName, args);
      console.log(formatted);
      logWriter.write(formatted, 'general');
    },

    success: (...args) => {
      if (!shouldLog('success', moduleName)) return;
      
      const formatted = formatLogMessage('success', LOG_STYLES.success, moduleName, args);
      console.log(formatted);
      logWriter.write(formatted, 'general');
    },

    warn: (...args) => {
      if (!shouldLog('warn', moduleName)) return;
      
      const formatted = formatLogMessage('warn', LOG_STYLES.warn, moduleName, args, { includeSource: true });
      console.warn(formatted);
      logWriter.write(formatted, 'general');
      
      // Take memory snapshot on warnings
      if (loggerOptions.enableMemoryTracking) {
        memoryTracker.takeSnapshot(`warning-${Date.now()}`);
      }
    },

    error: (...args) => {
      if (!shouldLog('error', moduleName)) return;
      
      const formatted = formatLogMessage('error', LOG_STYLES.error, moduleName, args, { includeSource: true });
      console.error(formatted);
      logWriter.write(formatted, 'error');
      
      // Handle error details
      args.forEach(arg => {
        if (arg instanceof Error && arg.stack) {
          const stackTrace = chalk.red.dim(arg.stack);
          console.error(stackTrace);
          logWriter.write(stackTrace, 'error');
        }
      });
      
      // Take memory snapshot on errors
      if (loggerOptions.enableMemoryTracking) {
        memoryTracker.takeSnapshot(`error-${Date.now()}`);
      }
    },

    fatal: (...args) => {
      const formatted = formatLogMessage('fatal', LOG_STYLES.fatal, moduleName, args, { includeSource: true });
      console.error(formatted);
      logWriter.write(formatted, 'error');
      
      // Force flush for fatal errors
      logWriter.buffer.flush();
      
      // Create crash dump
      logger.createCrashDump(args);
      
      if (loggerOptions.exitOnFatal !== false) {
        setTimeout(() => process.exit(1), 1000); // Give time for logs to flush
      }
    },

    security: (...args) => {
      const formatted = formatLogMessage('security', LOG_STYLES.security, moduleName, args, { includeSource: true });
      console.error(formatted);
      logWriter.write(formatted, 'security');
      
      // Structured security log
      const structuredLog = formatStructuredLog('security', moduleName, args, {
        severity: 'high',
        category: 'security_event',
        timestamp: new Date().toISOString()
      });
      logWriter.write(structuredLog, 'audit');
    },

    audit: (...args) => {
      const formatted = formatLogMessage('audit', LOG_STYLES.audit, moduleName, args);
      console.log(formatted);
      
      // Always write structured audit logs
      const structuredLog = formatStructuredLog('audit', moduleName, args, {
        auditType: 'user_action',
        timestamp: new Date().toISOString()
      });
      logWriter.write(structuredLog, 'audit');
    },

    cmd: (command, output = "", error = "", exitCode, metadata = {}) => {
      if (!shouldLog('cmd', moduleName)) return;
      
      const timestamp = chalk.bold.blue(`[${getTimestamp()}]`);
      const levelBadge = LOG_STYLES.cmd.bgColor(` ${LOG_STYLES.cmd.prefix} `);
      const icon = LOG_STYLES.cmd.color(LOG_STYLES.cmd.icon);
      const module = chalk.bold.white(`[${moduleName}]`);
      const separator = chalk.gray("•");
      
      let message = `Command: ${chalk.bold.cyan(command)}`;
      
      if (exitCode !== undefined) {
        const codeColor = exitCode === 0 ? chalk.green : chalk.red;
        message += ` | Exit Code: ${codeColor(exitCode)}`;
      }
      
      if (metadata.duration) {
        message += ` | Duration: ${chalk.yellow(metadata.duration.toFixed(2))}ms`;
      }
      
      if (output && output.trim()) {
        message += `\n${chalk.gray('Output:')} ${chalk.white(output.trim())}`;
      }
      
      if (error && error.trim()) {
        message += `\n${chalk.red('Error:')} ${chalk.red(error.trim())}`;
      }

      const formatted = `${timestamp} ${levelBadge} ${icon} ${module} ${separator} ${message}`;
      console.log(formatted);
      logWriter.write(formatted, 'general');
      
      // Structured command log
      const structuredLog = formatStructuredLog('cmd', moduleName, [command], {
        command,
        output: output || null,
        error: error || null,
        exitCode,
        ...metadata
      });
      logWriter.write(structuredLog, 'audit');
    },

    // Performance tracking methods
    perf: {
      start: (label, metadata = {}) => {
        performanceTracker.start(label, metadata);
        logger.trace(`Performance timer started: ${label}`);
        return label;
      },
      
      end: (label) => {
        try {
          const result = performanceTracker.end(label);
          logger.info(`Performance: ${label} completed in ${result.duration.toFixed(2)}ms`);
          return result;
        } catch (error) {
          logger.warn(`Performance timer '${label}' was not found or already ended`);
          return null;
        }
      },
      
      measure: (label, fn, metadata = {}) => {
        performanceTracker.start(label, metadata);
        try {
          const result = fn();
          const timing = performanceTracker.end(label);
          logger.info(`Performance: ${label} - ${timing.duration.toFixed(2)}ms`);
          return result;
        } catch (error) {
          performanceTracker.end(label);
          throw error;
        }
      },

      async measureAsync(label, fn, metadata = {}) {
        return performanceTracker.measure(label, fn, metadata);
      },

      getMetrics: (label = null) => performanceTracker.getMetrics(label),
      
      reset: (label = null) => performanceTracker.reset(label),
      
      onSlow: (callback) => {
        performanceTracker.on('slowOperation', callback);
      }
    },

    // Memory tracking methods
    memory: {
      usage: () => {
        const usage = MemoryTracker.getMemoryUsage();
        logger.info(`Memory Usage - ${MemoryTracker.formatMemoryUsage()}`);
        return usage;
      },
      
      snapshot: (label) => {
        return memoryTracker.takeSnapshot(label);
      },
      
      trend: () => {
        return memoryTracker.getMemoryTrend();
      },
      
      snapshots: (count = 10) => {
        return memoryTracker.getSnapshots(count);
      },
      
      enableLeakDetection: (threshold, interval) => {
        memoryTracker.enableLeakDetection(threshold, interval);
      },
      
      onLeak: (callback) => {
        memoryTracker.on('potentialLeak', callback);
      }
    },

    // Child logger creation
    child: (bindings = {}) => {
      const childName = bindings.module || bindings.name || `${moduleName}:Child`;
      const childOptions = { ...loggerOptions, ...bindings };
      return createLogger(childName, childOptions);
    },

    // Utility methods
    table: (data, options = {}) => {
      if (!shouldLog('info', moduleName)) return;
      
      console.table(data);
      const structuredLog = formatStructuredLog('info', moduleName, ['Table data displayed'], { 
        tableData: data,
        displayOptions: options 
      });
      logWriter.write(structuredLog, 'general');
    },

    group: (label, collapsed = false) => {
      if (!shouldLog('info', moduleName)) return;
      
      const formatted = chalk.bold.blue(`${collapsed ? '▶' : '▼'} ${label}`);
      console.group(formatted);
      logWriter.write(`GROUP_START: ${label}`, 'general');
    },

    groupEnd: () => {
      if (!shouldLog('info', moduleName)) return;
      
      console.groupEnd();
      logWriter.write('GROUP_END', 'general');
    },

    separator: (char = "─", length = 80, style = 'dim') => {
      if (!shouldLog('info', moduleName)) return;
      
      const sep = chalk[style](char.repeat(length));
      console.log(sep);
      logWriter.write(sep, 'general');
    },

    banner: (message, style = "double", color = 'cyan') => {
      if (!shouldLog('info', moduleName)) return;
      
      const chars = {
        single: { h: "─", v: "│", tl: "┌", tr: "┐", bl: "└", br: "┘" },
        double: { h: "═", v: "║", tl: "╔", tr: "╗", bl: "╚", br: "╝" },
        thick: { h: "━", v: "┃", tl: "┏", tr: "┓", bl: "┗", br: "┛" },
        rounded: { h: "─", v: "│", tl: "╭", tr: "╮", bl: "╰", br: "╯" }
      };
      
      const c = chars[style] || chars.double;
      const width = message.length + 4;
      const top = c.tl + c.h.repeat(width) + c.tr;
      const mid = c.v + ` ${message} ` + c.v;
      const bot = c.bl + c.h.repeat(width) + c.br;
      
      const colorFn = chalk.bold[color] || chalk.bold.cyan;
      
      console.log(colorFn(top));
      console.log(chalk.bold.white(mid));
      console.log(colorFn(bot));
      
      logWriter.write([top, mid, bot].join('\n'), 'general');
    },

    progress: (current, total, label = "Progress", options = {}) => {
      if (!shouldLog('info', moduleName)) return;
      
      const percentage = Math.round((current / total) * 100);
      const barWidth = options.width || 20;
      const filled = Math.round((current / total) * barWidth);
      const empty = barWidth - filled;
      
      const bar = "█".repeat(filled) + "░".repeat(empty);
      const progress = chalk.green(`[${bar}] ${percentage}% ${label} (${current}/${total})`);
      
      if (options.clearLine) {
        process.stdout.write(`\r${progress}`);
      } else {
        console.log(progress);
      }
    },

    json: (obj, label = "JSON Log", pretty = true) => {
      if (!shouldLog('info', moduleName)) return;
      
      const jsonString = pretty ? 
        JSON.stringify(obj, null, 2) : 
        JSON.stringify(obj);
      
      console.log(chalk.dim.cyan(`${label}:`));
      console.log(chalk.gray(jsonString));
      
      const structuredLog = formatStructuredLog('info', moduleName, [label], obj);
      logWriter.write(structuredLog, 'general');
    },

    // Conditional logging
    if: (condition, level = 'info') => ({
      log: (...args) => condition && logger[level](...args),
      trace: (...args) => condition && logger.trace(...args),
      debug: (...args) => condition && logger.debug(...args),
      info: (...args) => condition && logger.info(...args),
      warn: (...args) => condition && logger.warn(...args),
      error: (...args) => condition && logger.error(...args)
    }),

    // Throttled logging
    throttle: (interval = 1000) => {
      const lastCall = new Map();
      return {
        log: (level, ...args) => {
          const key = `${level}:${args.join('')}`;
          const now = Date.now();
          if (!lastCall.has(key) || now - lastCall.get(key) > interval) {
            lastCall.set(key, now);
            logger[level](...args);
          }
        }
      };
    },

    // Async logging methods
    async: {
      info: async (...args) => {
        return new Promise(resolve => {
          logger.info(...args);
          setImmediate(resolve);
        });
      },
      error: async (...args) => {
        return new Promise(resolve => {
          logger.error(...args);
          setImmediate(resolve);
        });
      },
      flush: async () => {
        return logWriter.flush();
      }
    },

    // Configuration methods
    setLevel: (level) => {
      process.env.LOG_LEVEL = level.toUpperCase();
    },

    getLevel: () => {
      return process.env.LOG_LEVEL || 'INFO';
    },

    addFilter: (filter) => {
      if (typeof filter === 'function') {
        loggerOptions.filters.custom.push(filter);
      }
    },

    // System methods
    flush: () => logWriter.flush(),
    
    getStats: () => ({
      logger: {
        moduleName,
        level: logger.getLevel(),
        options: loggerOptions
      },
      writer: logWriter.getStats(),
      performance: performanceTracker.getMetrics(),
      memory: memoryTracker.getSnapshots(5)
    }),

    createCrashDump: (args) => {
      const crashDump = {
        timestamp: new Date().toISOString(),
        module: moduleName,
        processInfo: getProcessInfo(),
        environmentInfo: getEnvironmentInfo(),
        memoryUsage: MemoryTracker.getMemoryUsage(),
        performanceMetrics: performanceTracker.getMetrics(),
        lastError: args,
        stackTrace: SourceTracker.getFullStackTrace(20)
      };
      
      const dumpPath = path.join(process.cwd(), 'data', 'logs', 'crashes', `crash-${Date.now()}.json`);
      
      fs.mkdir(path.dirname(dumpPath), { recursive: true })
        .then(() => fs.writeFile(dumpPath, JSON.stringify(crashDump, null, 2)))
        .catch(err => console.error('Failed to create crash dump:', err));
    },

    destroy: async () => {
      memoryTracker.disableLeakDetection();
      performanceTracker.removeAllListeners();
      await logWriter.destroy();
    }
  };

  return logger;
}

/**
 * Enhanced log level checking with module-specific filtering
 */
function shouldLog(level, moduleName = '') {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  const levelConfig = LOG_CONFIG.levels[level.toUpperCase()];
  const currentLevelValue = levelConfig ? levelConfig.value : 0;
  
  // Check custom filters
  if (LOG_CONFIG.filters.custom.length > 0) {
    const shouldFilter = LOG_CONFIG.filters.custom.some(filter => {
      return filter(level, moduleName);
    });
    if (shouldFilter) return false;
  }
  
  // Check module filters
  if (LOG_CONFIG.filters.module.length > 0) {
    const isModuleFiltered = LOG_CONFIG.filters.module.includes(moduleName);
    if (isModuleFiltered) return false;
  }
  
  // Check pattern filters
  if (LOG_CONFIG.filters.pattern) {
    const regex = new RegExp(LOG_CONFIG.filters.pattern, 'i');
    if (regex.test(moduleName)) return false;
  }
  
  // Check level
  if (!envLevel) {
    return !['trace', 'debug'].includes(level.toLowerCase());
  }
  
  const envLevelConfig = LOG_CONFIG.levels[envLevel];
  if (!envLevelConfig) return true;
  
  return currentLevelValue >= envLevelConfig.value;
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const gracefulExit = async (signal) => {
    console.log(chalk.yellow(`\n📋 Received ${signal}, shutting down gracefully...`));
    
    try {
      await logWriter.flush();
      await logWriter.destroy();
      console.log(chalk.green('✅ Logger shutdown complete'));
    } catch (error) {
      console.error(chalk.red('❌ Error during logger shutdown:'), error.message);
    }
    
    process.exit(0);
  };

  process.once('SIGINT', () => gracefulExit('SIGINT'));
  process.once('SIGTERM', () => gracefulExit('SIGTERM'));
}

// Setup graceful shutdown
setupGracefulShutdown();

// Create default logger instance
const defaultLogger = createLogger("Application");

// Attach factory and utilities to default logger
defaultLogger.createLogger = createLogger;
defaultLogger.LOG_LEVELS = Object.keys(LOG_CONFIG.levels);
defaultLogger.LOG_CONFIG = LOG_CONFIG;
defaultLogger.LOG_STYLES = LOG_STYLES;
defaultLogger.PerformanceTracker = PerformanceTracker;
defaultLogger.MemoryTracker = MemoryTracker;
defaultLogger.SourceTracker = SourceTracker;
defaultLogger.LogBuffer = LogBuffer;
defaultLogger.FileRotator = FileRotator;
defaultLogger.LogWriter = LogWriter;

// Global error handlers
process.on('uncaughtException', (error) => {
  defaultLogger.fatal('Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 2000); // Give time for logs to flush
});

process.on('unhandledRejection', (reason, promise) => {
  defaultLogger.fatal('Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    } : reason,
    promise: promise.toString()
  });
});

process.on('warning', (warning) => {
  defaultLogger.warn('Node.js Warning:', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack
  });
});

// Health monitoring
if (LOG_CONFIG.enableMetrics) {
  const healthMonitor = setInterval(() => {
    const stats = defaultLogger.getStats();
    
    // Log health metrics every 10 minutes
    defaultLogger.trace('System Health Check:', {
      memory: stats.memory?.[0]?.usage || MemoryTracker.getMemoryUsage(),
      performance: Object.keys(stats.performance || {}).length,
      logWriter: {
        totalWrites: stats.writer?.totalWrites || 0,
        failedWrites: stats.writer?.failedWrites || 0,
        bufferUtilization: stats.writer?.bufferStats?.bufferUtilization || 0
      }
    });
  }, 10 * 60 * 1000); // 10 minutes

  // Clear interval on exit
  process.on('exit', () => {
    clearInterval(healthMonitor);
  });
}

/**
 * Export the enhanced logging library
 */
export default defaultLogger;

export { 
  createLogger, 
  LOG_CONFIG, 
  LOG_STYLES, 
  PerformanceTracker, 
  MemoryTracker, 
  SourceTracker,
  LogBuffer,
  FileRotator,
  LogWriter,
  initializeLogDirectory,
  getLogFilePath,
  formatLogMessage,
  formatStructuredLog,
  shouldLog
};

/**
 * Usage Examples and Best Practices
 * 
 * Basic Usage:
 * ```javascript
 * import logger from './logger.js';
 * 
 * logger.info('Application started');
 * logger.error('Database connection failed', error);
 * logger.success('User registration completed', { userId: 123 });
 * ```
 * 
 * Performance Monitoring:
 * ```javascript
 * logger.perf.start('database-query');
 * // ... database operation
 * const timing = logger.perf.end('database-query');
 * 
 * // Or use measure for automatic timing
 * const result = logger.perf.measure('api-call', () => {
 *   return apiClient.getData();
 * });
 * ```
 * 
 * Child Loggers:
 * ```javascript
 * const dbLogger = logger.child({ module: 'Database' });
 * const apiLogger = logger.child({ module: 'API', requestId: 'req-123' });
 * 
 * dbLogger.info('Connection established');
 * apiLogger.error('Request failed', { statusCode: 500 });
 * ```
 * 
 * Structured Logging:
 * ```javascript
 * logger.audit('User login', {
 *   userId: 123,
 *   ip: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 *   timestamp: new Date().toISOString()
 * });
 * ```
 * 
 * Memory Monitoring:
 * ```javascript
 * logger.memory.enableLeakDetection(100, 30000); // 100MB threshold, check every 30s
 * logger.memory.onLeak((data) => {
 *   logger.warn('Memory leak detected:', data);
 * });
 * ```
 * 
 * Conditional Logging:
 * ```javascript
 * const debugLogger = logger.if(process.env.NODE_ENV === 'development');
 * debugLogger.log('debug', 'This only logs in development');
 * 
 * const throttledLogger = logger.throttle(5000); // Max once per 5 seconds
 * throttledLogger.log('info', 'Throttled message');
 * ```
 * 
 * Configuration:
 * ```javascript
 * // Set log level
 * logger.setLevel('DEBUG');
 * 
 * // Add custom filter
 * logger.addFilter((level, moduleName) => {
 *   return moduleName.includes('test') && level === 'debug';
 * });
 * ```
 * 
 * Clean Shutdown:
 * ```javascript
 * process.on('SIGTERM', async () => {
 *   await logger.flush();
 *   await logger.destroy();
 *   process.exit(0);
 * });
 * ```
 */

/**
 * Configuration Examples
 * 
 * Environment Variables:
 * - LOG_LEVEL: Set minimum log level (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
 * - NODE_ENV: Affects default logging behavior
 * 
 * Custom Logger:
 * ```javascript
 * const customLogger = createLogger('MyModule', {
 *   maxFileSize: 100 * 1024 * 1024, // 100MB
 *   maxFiles: 50,
 *   bufferSize: 2000,
 *   flushInterval: 3000,
 *   enableMemoryTracking: true,
 *   enablePerformanceTracking: true,
 *   performance: {
 *     slowThreshold: 2000, // 2 seconds
 *     trackSystemMetrics: true
 *   }
 * });
 * ```
 */