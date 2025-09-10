import { Boom } from "@hapi/boom";
import NodeCache from "@cacheable/node-cache";
import readline from "readline";
import fs from "fs";
import path from "path";
import pino from "pino";
import makeWASocket, {
  BinaryInfo,
  Browsers,
  delay,
  DisconnectReason,
  encodeWAM,
  fetchLatestBaileysVersion,
  getAggregateVotesInPollMessage,
  isJidNewsletter,
  makeCacheableSignalKeyStore,
  proto,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

import { handleCommand, loadPlugins } from "./handler.js"
import { createLogger } from "./src/utils/logger.js";
const log = createLogger("Baileys");

const msgRetryCounterCache = new NodeCache({
  stdTTL: 300,
  maxKeys: 1000,
});

const onDemandMap = new Map();
const messageStore = new Map();
const pollStore = new Map();

const P = pino({
  level: "fatal",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (text) =>
  new Promise((resolve) => rl.question(text, resolve));

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log.info(`Created directory: ${dirPath}`);
  }
};

const getMessage = async (key) => {
  try {
    const stored = messageStore.get(key.id);
    if (stored) {
      return stored.message;
    }
    
    return proto.Message.create({
      conversation: "Message not found in cache",
    });
  } catch (error) {
    log.error("Error retrieving message:", error.message);
    return proto.Message.create({
      conversation: "Error retrieving message",
    });
  }
};

const handleMessages = (sock) => {
  sock.ev.on("messages.upsert", async (m) => {
    try {
      const messages = m.messages;
      
      for (const message of messages) {
        if (message.key?.id) {
          messageStore.set(message.key.id, { message, timestamp: Date.now() });
        }

        if (message.key.fromMe) continue;

        if (!message.message) continue;
        
        handleCommand(sock, message)
      }
    } catch (error) {
      log.error("Error handling messages:", error.message);
    }
  });

  sock.ev.on("messages.update", (messageUpdate) => {
    for (const update of messageUpdate) {
      if (update.key?.id && messageStore.has(update.key.id)) {
        const stored = messageStore.get(update.key.id);
        messageStore.set(update.key.id, { ...stored, ...update });
      }
    }
  });

  sock.ev.on("presence.update", ({ id, presences }) => {
    log.debug(`Presence update for ${id}:`, Object.keys(presences));
  });

  sock.ev.on("groups.update", (updates) => {
    for (const update of updates) {
      log.info(`Group update for ${update.id}:`, update);
    }
  });
};

export const startSocket = async () => {
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 3000;

  try {
    const sessionPath = "./data/sessions";
    ensureDirectoryExists(path.dirname(sessionPath));

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    log.info(`Using WA v${version.join(".")}, latest: ${isLatest}`);

    const sock = makeWASocket({
      version,
      logger: P,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P),
      },
      msgRetryCounterCache,
      generateHighQualityLinkPreview: true,
      getMessage,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 10_000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      browser: Browsers.ubuntu("Edge"),
      printQRInTerminal: false,
    });

    if (!sock.authState.creds.registered) {
      let phoneNumber = await question("Please enter your phone number (with country code, e.g., +62812345678):\n");
      
      phoneNumber = phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
      
      try {
        const code = await sock.requestPairingCode(phoneNumber, "BASEBOTS");
        log.success(`Pairing code: ${code}`);
        log.info("Enter this code in your WhatsApp app: Settings > Linked Devices > Link a Device");
      } catch (error) {
        log.error("Failed to request pairing code:", error.message);
        throw error;
      }
    }

    sock.ev.on("creds.update", saveCreds);
    loadPlugins();

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        log.info("QR Code generated, scan with WhatsApp");
      }

      if (connection === "close") {
        const shouldReconnect = 
          lastDisconnect?.error instanceof Boom &&
          lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;

        log.error(
          `Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`
        );

        if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 60000);
          reconnectAttempts++;
          
          log.info(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          
          setTimeout(() => {
            startSocket();
          }, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          log.error("Maximum reconnection attempts reached. Exiting...");
          process.exit(1);
        } else {
          log.warn("Connection closed. You are logged out.");
          rl.close();
          process.exit(0);
        }
      } else if (connection === "open") {
        log.success("Connected successfully!");
        reconnectAttempts = 0;
        
        await sendTestWAM(sock);
      } else if (connection === "connecting") {
        log.info("Connecting to WhatsApp...");
      }
    });

    handleMessages(sock);

    setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;
      
      for (const [id, data] of messageStore.entries()) {
        if (now - data.timestamp > maxAge) {
          messageStore.delete(id);
        }
      }
      
      log.debug(`Message cache size: ${messageStore.size}`);
    }, 60 * 60 * 1000);

    return sock;

  } catch (error) {
    log.error("Failed to start socket:", error.message);
    
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 60000);
      reconnectAttempts++;
      
      log.info(`Retrying in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
      
      setTimeout(() => {
        startSocket();
      }, delay);
    } else {
      log.error("Failed to start after maximum attempts. Exiting...");
      process.exit(1);
    }
  }
};

const sendTestWAM = async (sock, enabled = false) => {
  if (!enabled) return;

  try {
    const analyticsPath = "./data/boot_analytics_test.json";
    
    if (!fs.existsSync(analyticsPath)) {
      log.warn("Analytics test file not found, skipping WAM test");
      return;
    }

    const analyticsData = JSON.parse(fs.readFileSync(analyticsPath, "utf-8"));
    const {
      header: { wamVersion, eventSequenceNumber },
      events,
    } = analyticsData;

    const binaryInfo = new BinaryInfo({
      protocolVersion: wamVersion,
      sequence: eventSequenceNumber,
      events,
    });

    const buffer = encodeWAM(binaryInfo);
    const result = await sock.sendWAMBuffer(buffer);
    log.success("WAM sent:", result);
  } catch (error) {
    log.error("Failed to send WAM:", error.message);
  }
};
