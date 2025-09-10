export const sendMessageWTyping = async (sock, msg, jid) => {
  await sock.presenceSubscribe(jid);
  await delay(500);
  await sock.sendPresenceUpdate("composing", jid);
  await delay(2000);
  await sock.sendPresenceUpdate("paused", jid);
  return await sock.sendMessage(jid, msg);
};