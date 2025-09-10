import { exec as childExec } from "child_process";
import util from "util";

const execAsync = util.promisify(childExec);

export default {
  name: "exec",
  description: "Execute shell commands (Owner only)",
  aliases: ["sh", "bash"],
  cooldown: 0,
  isOwner: true,
  isAdmin: false,
  isGroup: false,
  isPrivate: false,
  async exec(sock, msg, args, metadata) {
    if (!args.length) {
      return sock.sendMessage(
        metadata.from,
        { text: "❌ Masukkan perintah shell untuk dijalankan." },
        { quoted: msg }
      );
    }

    const command = args.join(" ");
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 60_000 });

      let output = "";
      if (stdout) output += "📤 *Output:*\n```" + stdout.trim() + "```\n";
      if (stderr) output += "⚠️ *Error:*\n```" + stderr.trim() + "```";

      if (!output) output = "✅ Command executed successfully (no output).";

      await sock.sendMessage(
        metadata.from,
        { text: output },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        metadata.from,
        { text: "💥 *Exec Failed:*\n```" + err.message + "```" },
        { quoted: msg }
      );
    }
  },
};