import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import TelegramBot from 'node-telegram-bot-api';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory store for submissions
const submissions = new Map<string, { status: 'under_review' | 'approved' | 'rejected', details: any }>();

// Setup Telegram Bot if token exists
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot: TelegramBot | null = null;

if (token) {
  bot = new TelegramBot(token, { polling: true });
  console.log("Telegram bot initialized for manual review.");

  bot.on('polling_error', (error: any) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
      console.warn("Telegram polling conflict: Another instance is running.");
    } else {
      console.error("Telegram polling error:", error);
    }
  });

  process.once('SIGINT', () => bot?.stopPolling());
  process.once('SIGTERM', () => bot?.stopPolling());

  bot.on('callback_query', (query) => {
    if (!query.data || !query.message) return;
    
    const firstUnderscore = query.data.indexOf('_');
    const action = query.data.substring(0, firstUnderscore);
    const id = query.data.substring(firstUnderscore + 1);
    if (submissions.has(id)) {
      if (action === 'approve') {
        submissions.get(id)!.status = 'approved';
        bot?.answerCallbackQuery(query.id, { text: 'Submission Approved' });
        bot?.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
        bot?.sendMessage(query.message.chat.id, `✅ Approved submission ${id}`);
      } else if (action === 'reject') {
        submissions.get(id)!.status = 'rejected';
        bot?.answerCallbackQuery(query.id, { text: 'Submission Rejected' });
        bot?.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
        bot?.sendMessage(query.message.chat.id, `❌ Rejected submission ${id}`);
      }
    } else {
      bot?.answerCallbackQuery(query.id, { text: 'Submission not found or expired', show_alert: true });
    }
  });
}

app.post("/api/submit-for-review", async (req, res) => {
  const { id, type, details, imageBase64 } = req.body;
  if (!id) return res.status(400).json({ error: "Missing submission ID" });

  submissions.set(id, { status: 'under_review', details });

  if (bot && chatId) {
    try {
      const message = `New ${type === 'check_in' ? 'Check-in' : 'Straykin'} Submission! 🐱\nID: ${id}\nDetails: ${JSON.stringify(details, null, 2)}`;
      
      const inlineKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `approve_${id}` },
              { text: '❌ Reject', callback_data: `reject_${id}` }
            ]
          ]
        }
      };

      if (imageBase64) {
        const buffer = Buffer.from(imageBase64.split(',')[1] || imageBase64, 'base64');
        await bot.sendPhoto(chatId, buffer, { caption: message, ...inlineKeyboard });
      } else {
        await bot.sendMessage(chatId, message, inlineKeyboard);
      }
    } catch (e: any) {
      console.error("Failed to send telegram message:", e.message || e);
      if (e?.response?.statusCode === 403) {
         console.error("Hint: Make sure the TELEGRAM_CHAT_ID is correct (your personal ID or group ID, NOT the bot's ID) and that you have started a conversation with the bot by sending it a message or pressing /start.");
      }
    }
  } else {
    // If no telegram bot configured, auto-approve after 5 seconds to allow testing
    console.log(`[Review] Received submission ${id}. No Telegram bot configured. Auto-approving in 5s.`);
    setTimeout(() => {
      if (submissions.has(id)) submissions.get(id)!.status = 'approved';
    }, 5000);
  }

  res.json({ success: true, status: 'under_review' });
});

app.get("/api/submission-status/:id", (req, res) => {
  const sub = submissions.get(req.params.id);
  if (!sub) return res.status(404).json({ error: "Not found" });
  res.json({ status: sub.status });
});


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
