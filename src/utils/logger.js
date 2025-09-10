import chalk from "chalk";
import dayjs from "dayjs";
import fs from "fs";
import path from "path";

const LOG_CONFIG = {
  dateFormat: "YYYY-MM-DD HH:mm:ss.SSS",
  fileFormat: "YYYY-MM-DD",
  encoding: "utf8",
  levels: {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    SUCCESS: 3,
    WARN: 4,
    ERROR: 5,
    CMD: 6
  }
};

const LOG_STYLES = {
  info: {
    icon: "ℹ",
    color: chalk.bold.cyan,
    bgColor: chalk.bgCyan.black.bold,
    prefix: "INFO"
  },
  success: {
    icon: "✅",
    color: chalk.bold.green,
    bgColor: chalk.bgGreen.black.bold,
    prefix: "SUCCESS"
  },
  warn: {
    icon: "⚠️",
    color: chalk.bold.yellow,
    bgColor: chalk.bgYellow.black.bold,
    prefix: "WARNING"
  },
  error: {
    icon: "❌",
    color: chalk.bold.red,
    bgColor: chalk.bgRed.white.bold,
    prefix: "ERROR"
  },
  debug: {
    icon: "🐛",
    color: chalk.bold.magenta,
    bgColor: chalk.bgMagenta.white.bold,
    prefix: "DEBUG"
  },
  trace: {
    icon: "🔍",
    color: chalk.bold.gray,
    bgColor: chalk.bgGray.white.bold,
    prefix: "TRACE"
  },
  cmd: {
    icon: "⚡",
    color: chalk.bold.white,
    bgColor: chalk.bgBlue.white.bold,
    prefix: "CMD"
  }
};

function initializeLogDirectory() {
  const logDir = path.join(process.cwd(), "data", "logs");
  
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
  } catch (error) {
    console.error(chalk.bold.red("Failed to create log directory:"), error.message);
    return null;
  }
}

function getLogFilePath() {
  const logDir = initializeLogDirectory();
  if (!logDir) return null;
  
  return path.join(logDir, `${dayjs().format(LOG_CONFIG.fileFormat)}.log`);
}

function writeToFile(content) {
  const logFile = getLogFilePath();
  if (!logFile) return;

  try {
    const cleanContent = content.replace(/\x1b\[[0-9;]*m/g, '');
    fs.appendFileSync(logFile, cleanContent + "\n", LOG_CONFIG.encoding);
  } catch (error) {
    console.error(chalk.bold.red("Failed to write to log file:"), error.message);
  }
}

function getTimestamp() {
  return dayjs().format(LOG_CONFIG.dateFormat);
}

function formatLogMessage(level, style, moduleName, args) {
  const timestamp = chalk.bold.blue(`[${getTimestamp()}]`);
  const levelBadge = style.bgColor(` ${style.prefix} `);
  const icon = style.color(style.icon);
  const module = chalk.bold.white(`[${moduleName}]`);
  const separator = chalk.gray("•");
  
  const message = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return chalk.gray(JSON.stringify(arg, null, 2));
    }
    return chalk.white(String(arg));
  }).join(' ');

  return `${timestamp} ${levelBadge} ${icon} ${module} ${separator} ${message}`;
}

function formatCmdMessage(moduleName, command, output, error, exitCode) {
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
  
  if (output && output.trim()) {
    message += `\n${chalk.gray('Output:')} ${chalk.white(output.trim())}`;
  }
  
  if (error && error.trim()) {
    message += `\n${chalk.red('Error:')} ${chalk.red(error.trim())}`;
  }

  return `${timestamp} ${levelBadge} ${icon} ${module} ${separator} ${message}`;
}

function createLogger(moduleName = "Application") {
  const logger = {
    info: (...args) => {
      const formatted = formatLogMessage("info", LOG_STYLES.info, moduleName, args);
      console.log(formatted);
      writeToFile(formatted);
    },

    success: (...args) => {
      const formatted = formatLogMessage("success", LOG_STYLES.success, moduleName, args);
      console.log(formatted);
      writeToFile(formatted);
    },

    warn: (...args) => {
      const formatted = formatLogMessage("warn", LOG_STYLES.warn, moduleName, args);
      console.warn(formatted);
      writeToFile(formatted);
    },

    error: (...args) => {
      const formatted = formatLogMessage("error", LOG_STYLES.error, moduleName, args);
      console.error(formatted);
      writeToFile(formatted);
      
      if (args[0] instanceof Error) {
        const stackTrace = chalk.red.dim(args[0].stack);
        console.error(stackTrace);
        writeToFile(stackTrace);
      }
    },

    debug: (...args) => {
      if (shouldLog("debug")) {
        const formatted = formatLogMessage("debug", LOG_STYLES.debug, moduleName, args);
        console.log(formatted);
        writeToFile(formatted);
      }
    },

    trace: (...args) => {
      if (shouldLog("trace")) {
        const formatted = formatLogMessage("trace", LOG_STYLES.trace, moduleName, args);
        console.log(formatted);
        writeToFile(formatted);
      }
    },

    cmd: (command, output = "", error = "", exitCode) => {
      const formatted = formatCmdMessage(moduleName, command, output, error, exitCode);
      console.log(formatted);
      writeToFile(formatted);
    },

    child: (bindings = {}) => {
      const childName = bindings.module || bindings.name || `${moduleName}:Child`;
      return createLogger(childName);
    },

    table: (data) => {
      console.table(data);
      logger.info("Table data:", data);
    },

    group: (label) => {
      const formatted = chalk.bold.blue(`┌─ ${label} ─`);
      console.group(formatted);
      writeToFile(formatted);
    },

    groupEnd: () => {
      const formatted = chalk.bold.blue("└─────────────");
      console.groupEnd();
      writeToFile(formatted);
    },

    time: (label) => {
      console.time(chalk.bold.cyan(label));
    },

    timeEnd: (label) => {
      console.timeEnd(chalk.bold.cyan(label));
    },

    separator: () => {
      const sep = chalk.gray("─".repeat(80));
      console.log(sep);
      writeToFile(sep);
    },

    banner: (message) => {
      const border = chalk.bold.cyan("═".repeat(message.length + 4));
      const content = chalk.bold.white(`║ ${message} ║`);
      
      console.log(border);
      console.log(content);
      console.log(border);
      
      writeToFile(border);
      writeToFile(content);
      writeToFile(border);
    }
  };

  return logger;
}

function shouldLog(level) {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  const currentLevel = LOG_CONFIG.levels[level.toUpperCase()] || 0;
  
  if (!envLevel) return level !== "debug" && level !== "trace";
  
  const envLevelNum = LOG_CONFIG.levels[envLevel.toUpperCase()];
  return currentLevel >= envLevelNum;
}

const defaultLogger = createLogger();

defaultLogger.createLogger = createLogger;
defaultLogger.LOG_LEVELS = Object.keys(LOG_CONFIG.levels);

export default defaultLogger;
export { createLogger };