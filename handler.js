import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import logger from "./src/utils/logger.js";
import { getMessageMetadata } from "./src/utils/getMessageMetadata.js";
import config from "./config.json" with { type: "json" };

export const plugins = new Map();
const cooldowns = new Map();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPlugin(file) {
  const filePath = path.join(process.cwd(), "./commands/plugins", file);
  try {
    const url = pathToFileURL(filePath).href + `?update=${Date.now()}`;
    const mod = await import(url);
    const plugin = mod.default;

    if (!plugin?.name) {
      logger.warn(`⚠️ Skipped invalid plugin: ${file}`);
      return;
    }

    plugins.forEach((p, key) => {
      if (p.name === plugin.name) plugins.delete(key);
    });

    plugins.set(plugin.name, plugin);

    if (plugin.aliases) {
      for (const alias of plugin.aliases) {
        plugins.set(alias, plugin);
      }
    }

    logger.success(`✅ Loaded plugin: ${plugin.name}`);
  } catch (err) {
    logger.error(`❌ Failed to load plugin ${file}: ${err.message}`);
  }
}

export async function loadPlugins() {
  const dir = path.join(process.cwd(), "./commands/plugins");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    await loadPlugin(file);
  }

  fs.watch(dir, async (eventType, filename) => {
    if (!filename.endsWith(".js")) return;
    logger.info(`♻️ Reloading plugin: ${filename}`);
    await loadPlugin(filename);
  });
}

export async function handleCommand(sock, msg, prefixes = ["/", "!", "."]) {
  const metadata = getMessageMetadata(msg);
  if (!metadata) return;

  const { text, from, participant, type } = metadata;
  if (!text) return;

  const prefix = prefixes.find((p) => text.startsWith(p));
  if (!prefix) return;

  const args = text.slice(prefix.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  const plugin = plugins.get(cmd);
  if (!plugin) return;

  if (plugin.cooldown) {
    const now = Date.now();
    const userId = participant || from;
    const key = `${plugin.name}_${userId}`;
    if (cooldowns.has(key)) {
      const expires = cooldowns.get(key);
      if (now < expires) {
        const wait = Math.ceil((expires - now) / 1000);
        return sock.sendMessage(
          from,
          { text: `⏳ Please wait ${wait}s before using this command again.` },
          { quoted: msg }
        );
      }
    }
    cooldowns.set(key, now + plugin.cooldown * 1000);
  }

  const isGroup = from.endsWith("@g.us");
  const sender = participant || from;

  if (plugin.isGroup && !isGroup) {
    return sock.sendMessage(
      from,
      { text: "❌ This command can only be used in groups." },
      { quoted: msg }
    );
  }

  if (plugin.isPrivate && isGroup) {
    return sock.sendMessage(
      from,
      { text: "❌ This command can only be used in private chat." },
      { quoted: msg }
    );
  }

  if (plugin.isOwner && !config.config.ownerJid.includes(sender)) {
    return sock.sendMessage(
      from,
      { text: "❌ Owner only." },
      { quoted: msg }
    );
  }
  
  if (plugin.isAdmin && isGroup) {
    const metadataGroup = await sock.groupMetadata(from);
    const admins = metadataGroup.participants
      .filter((p) => p.admin)
      .map((p) => p.id);
    if (!admins.includes(sender)) {
      return sock.sendMessage(
        from,
        { text: "❌ This command is for admins only." },
        { quoted: msg }
      );
    }
  }

  try {
    logger.cmd(`${plugin.name} triggered by ${sender} (${type})`);
    await plugin.exec(sock, msg, args, metadata);
  } catch (err) {
    logger.error(`💥 Command ${plugin.name} failed: ${err.stack}`);
    await sock.sendMessage(
      from,
      { text: "❌ Command error, check logs." },
      { quoted: msg }
    );
  }
}