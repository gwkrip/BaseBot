# BaseBot WhatsApp

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Baileys](https://img.shields.io/badge/Baileys-7.0.0--rc.2-blue?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)](https://github.com/gwkrip/BaseBot)

> **Simple BaseBot implementation with new Baileys version**

BaseBot is a lightweight and extensible WhatsApp bot built with the latest Baileys library, featuring a modular command system, ES6 modules, and modern JavaScript architecture.

## Features

- **Latest Baileys** - Built with @whiskeysockets/baileys v7.0.0-rc.2
- **ES6 Modules** - Modern JavaScript with import/export syntax
- **Modular Architecture** - Plugin-based command system
- **Easy Configuration** - JSON-based configuration file
- **Command Handler** - Automatic command loading and execution
- **Multi-Owner Support** - Support for multiple bot owners
- **Aliases Support** - Commands can have multiple aliases
- **Cooldown System** - Built-in command cooldown management
- **Permission System** - Owner, admin, group, and private chat permissions
- **Process Management** - PM2 ecosystem configuration included
- **Caching System** - Node-cache integration for performance
- **Beautiful Logging** - Chalk and pino-pretty for enhanced console output
- **Date Management** - DayJS for date/time operations

## Prerequisites

- **Node.js** (v16.0.0 or higher) - Required for ES6 modules
- **npm** package manager
- **Git** for cloning the repository

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/gwkrip/BaseBot.git
cd BaseBot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Bot

Edit `config.json` with your settings:

```json
{
  "config": {
    "name": "BaseBot",
    "ownerJid": [
      "62882005514880@s.whatsapp.net",
      "62882003353414@s.whatsapp.net"
    ],
    "ownerLid": [""]
  }
}
```

Replace the phone numbers with your WhatsApp numbers (include country code).

### 4. Run the Bot

```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start

# Using PM2 (recommended for production)
npm run production
```

### 5. Scan QR Code

Scan the QR code that appears in your terminal with your WhatsApp mobile app.

## Project Structure

```
BaseBot/
├── commands/
│   └── plugins/        # Bot command plugins
├── data/              # Bot data and sessions
├── src/               # Source code
├── config.json        # Bot configuration
├── handler.js         # Command handler
├── index.js          # Main bot file
├── main.js           # Entry point
├── ecosystem.config.js # PM2 configuration
├── nodemon.json      # Nodemon configuration
└── package.json      # Dependencies
```

## Usage

### Basic Commands

The bot comes with several built-in commands. Here's an example:

| Command | Description | Usage | Aliases |
|---------|-------------|-------|---------|
| `ping` | Test bot responsiveness | `ping` | `p` |

### Command Response

When you send `ping`, the bot will respond with:
- Initial "Pong!" message
- Detailed response showing delay time and sender name

## Creating Commands

Create new commands in the `commands/plugins/` directory. Here's the command structure:

```javascript
export default {
  name: "command_name",           // Command name
  description: "Command description", // Command description
  aliases: ["alias1", "alias2"],  // Alternative command names
  cooldown: 3,                    // Cooldown in seconds
  isOwner: false,                 // Owner only command
  isAdmin: false,                 // Admin only command
  isGroup: false,                 // Group only command
  isPrivate: false,               // Private chat only command
  
  async exec(sock, msg, args, metadata) {
    // Command execution logic
    await sock.sendMessage(
      metadata.from,
      { text: "Your response here" },
      { quoted: msg }
    );
  }
};
```

### Command Parameters

- **sock**: WhatsApp socket connection
- **msg**: Original message object
- **args**: Command arguments array
- **metadata**: Message metadata (from, pushName, etc.)

### Permission System

- **isOwner**: Only bot owners can use this command
- **isAdmin**: Only group admins can use this command
- **isGroup**: Command only works in groups
- **isPrivate**: Command only works in private chats

## Configuration

### Bot Settings

Edit `config.json` to customize your bot:

```json
{
  "config": {
    "name": "YourBotName",
    "ownerJid": [
      "yourphone@s.whatsapp.net"
    ],
    "ownerLid": [""]
  }
}
```

### PM2 Production

For production deployment:

```bash
# Start with PM2 (uses npm script)
npm run production

# Or directly with PM2
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 monit

# View logs
pm2 logs BaseBot

# Restart
pm2 restart BaseBot
```

### Development Configuration

The `nodemon.json` file handles automatic restarts during development:

```json
{
  "watch": ["src", "commands", "config.json"],
  "ext": "js,json",
  "ignore": ["node_modules", "data"]
}
```

## Dependencies

### Core Dependencies

- **[@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)** `^7.0.0-rc.2` - WhatsApp Web API
- **[@cacheable/node-cache](https://github.com/jaredwray/cacheable)** `^1.7.0` - Caching layer for performance
- **[chalk](https://github.com/chalk/chalk)** `^5.6.2` - Terminal string styling
- **[dayjs](https://github.com/iamkun/dayjs)** `^1.11.18` - Date manipulation library
- **[pino-pretty](https://github.com/pinojs/pino-pretty)** `^13.1.1` - Pretty logging formatter
- **[cluster](https://www.npmjs.com/package/cluster)** `^0.7.7` - Node.js cluster module

### Development Features

- **ES6 Modules** - Uses `"type": "module"` for modern import/export
- **Nodemon** - Automatic restart during development
- **PM2** - Process management for production

## Command Handler

The bot uses an automatic command handler that:

- Loads all commands from `commands/plugins/`
- Handles command execution
- Manages cooldowns and permissions
- Processes command aliases
- Provides error handling

## Development

### Adding New Features

1. Create new command files in `commands/plugins/`
2. Follow the command structure template
3. Test your commands in development mode
4. Update documentation as needed

### File Naming

- Command files should use `.js` extension
- Use descriptive names for command files
- Export default object with command configuration

## Troubleshooting

### Common Issues

**Bot not responding:**
- Check if the command exists in `commands/plugins/`
- Verify command permissions
- Check cooldown status

**QR Code issues:**
- Clear `data/` directory and restart
- Ensure stable internet connection
- Try different WhatsApp Web session

**Permission errors:**
- Verify your JID is in `ownerJid` array
- Check group admin status for admin commands
- Ensure correct chat type (group/private)

### Debug Mode

Run with debug information:

```bash
npm run dev
```

This will show detailed logs and auto-restart on file changes.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-command`)
3. Commit your changes (`git commit -am 'Add new command'`)
4. Push to the branch (`git push origin feature/new-command`)
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/gwkrip/BaseBot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gwkrip/BaseBot/discussions)

---

<div align="center">

**Made by [Vrypt](https://github.com/gwkrip) - Author of BaseBot**

[Back to Top](#basebot-whatsapp)

</div>
