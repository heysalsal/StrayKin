import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';

async function test() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token) {
    console.log("No token in env");
    return;
  }
  if (!chatId) {
    console.log("No chatId in env");
    return;
  }
  console.log("Token and ChatID are present in env");
}
test();
