import util from "util";

export default {
  name: "eval",
  description: "Evaluate JavaScript code (Owner only)",
  aliases: ["ev"],
  cooldown: 0,
  isOwner: true,
  isAdmin: false,
  isGroup: false,
  isPrivate: false,
  async exec(sock, msg, args, metadata) {
    if (!args.length) {
      return sock.sendMessage(
        metadata.from,
        { text: "❌ Masukkan kode JavaScript untuk dievaluasi." },
        { quoted: msg }
      );
    }

    const code = args.join(" ");
    try {
      let result = await eval(`(async () => { ${code} })()`);
      if (typeof result !== "string") {
        result = util.inspect(result, { depth: 2 });
      }

      await sock.sendMessage(
        metadata.from,
        { text: "✅ *Eval Result:*\n```" + result + "```" },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        metadata.from,
        { text: "❌ *Error:*\n```" + err.message + "```" },
        { quoted: msg }
      );
    }
  },
};