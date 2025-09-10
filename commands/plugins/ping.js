export default {
  name: "ping",
  description: "Test bot responsiveness",
  aliases: ["p"],
  cooldown: 3,
  isOwner: false,
  isAdmin: false,
  isGroup: false,
  isPrivate: false,
  async exec(sock, msg, args, metadata) {
    const start = Date.now();

    const sent = await sock.sendMessage(
      metadata.from,
      { text: "🏓 Pong!" },
      { quoted: msg }
    );

    const end = Date.now();
    const delay = end - start;

    await sock.sendMessage(
      metadata.from,
      {
        text: `✅ Ping success!\n\n*Delay:* ${delay}ms\n*From:* ${metadata.pushName || "Unknown"}`
      },
      { quoted: sent }
    );
  },
};