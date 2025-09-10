import {
  getAggregateVotesInPollMessage,
  extractMessageContent
} from "@whiskeysockets/baileys";

export function getMessageMetadata(msg) {
  if (!msg) return null;

  const {
    key,
    messageTimestamp,
    pushName,
    status
  } = msg;

  const content = extractMessageContent(msg.message) || {};
  const messageType = Object.keys(content || {})[0] || "unknown";

  let text = "";
  if (content.conversation) {
    text = content.conversation;
  } else if (content.extendedTextMessage?.text) {
    text = content.extendedTextMessage.text;
  } else if (content.imageMessage?.caption) {
    text = content.imageMessage.caption;
  } else if (content.videoMessage?.caption) {
    text = content.videoMessage.caption;
  }

  const quoted = content?.extendedTextMessage?.contextInfo?.quotedMessage
    ? extractMessageContent(content.extendedTextMessage.contextInfo.quotedMessage)
    : null;

  let poll = null;
  if (content.pollCreationMessageV3) {
    poll = {
      name: content.pollCreationMessageV3.name,
      options: content.pollCreationMessageV3.options?.map(o => o.optionName),
    };
  } else if (content.pollUpdateMessage) {
    poll = getAggregateVotesInPollMessage({
      message: content,
      pollUpdates: msg.pollUpdates || []
    });
  }

  return {
    id: key.id,
    from: key.remoteJid,
    participant: key.participant || null,
    fromMe: key.fromMe,
    pushName,
    timestamp: Number(messageTimestamp),
    status,
    type: messageType,
    text,
    quoted,
    poll,
    raw: content,
  };
}