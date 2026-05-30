import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import TelegramBot from 'node-telegram-bot-api';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const submissions = new Map<string, { status: 'under_review' | 'approved' | 'rejected', details: any, imageBase64?: string }>();

async function uploadToBunny(imageBase64: string): Promise<string | null> {
  try {
    const accessKey = process.env.BUNNY_API_KEY || "eea8fffd-53b3-4080-bd99-3ef5d83ff9a13aaa1ec7-053b-4797-a824-e818158032e8";
    const zoneName = process.env.BUNNY_ZONE_NAME || "straykin"; 
    let region = process.env.BUNNY_REGION || ""; 
    let storageDomain = "storage.bunnycdn.com";
    
    if (region.includes("storage.bunnycdn.com")) {
      storageDomain = region;
    } else if (region) {
      storageDomain = `${region.endsWith('.') ? region : region + '.'}storage.bunnycdn.com`;
    }
    
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const fileName = `straykin_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    
    const url = `https://${storageDomain}/${zoneName}/images/${fileName}`;
    
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "AccessKey": accessKey,
        "Content-Type": "application/octet-stream"
      },
      body: buffer
    });
    
    if (response.ok) {
      let pullZoneDomain = process.env.BUNNY_PULL_ZONE || `${zoneName}.b-cdn.net`;
      pullZoneDomain = pullZoneDomain.replace(/Main$/, '');
      return `https://${pullZoneDomain}/images/${fileName}`;
    } else {
      const respText = await response.text();
      console.error("Bunny upload failed:", respText);
      return null;
    }
  } catch (error: any) {
    console.error("Bunny API error:", error);
    return null;
  }
}

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

  bot.on('callback_query', async (query) => {
    if (!query.data || !query.message) return;
    
    const firstUnderscore = query.data.indexOf('_');
    const action = query.data.substring(0, firstUnderscore);
    const id = query.data.substring(firstUnderscore + 1);
    
    if (submissions.has(id)) {
      const sub = submissions.get(id)!;
      bot?.answerCallbackQuery(query.id, { text: 'Processing...' }).catch(() => {});
      
      if (action === 'approve') {
        if (sub.imageBase64 && sub.imageBase64.startsWith('data:image')) {
          bot?.sendMessage(query.message.chat.id, `Uploading image to BunnyCDN...`).catch(() => {});
          const url = await uploadToBunny(sub.imageBase64);
          if (url) {
            sub.details = sub.details || {};
            sub.details.photoDataUrl = url;
          } else {
             sub.details = sub.details || {};
             sub.details.photoDataUrl = sub.imageBase64;
          }
        }
        sub.status = 'approved';
        bot?.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id }).catch(() => {});
        bot?.sendMessage(query.message.chat.id, `✅ Approved submission ${id}`).catch(() => {});
      } else if (action === 'reject') {
        sub.status = 'rejected';
        bot?.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id }).catch(() => {});
        bot?.sendMessage(query.message.chat.id, `❌ Rejected submission ${id}`).catch(() => {});
      }
    } else {
      bot?.answerCallbackQuery(query.id, { text: 'Submission not found or expired', show_alert: true }).catch(() => {});
    }
  });
}

app.post("/api/upload-image", async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image" });

  const url = await uploadToBunny(imageBase64);
  if (url) {
    return res.json({ success: true, url });
  } else {
    return res.status(500).json({ error: "Upload failed" });
  }
});

app.post("/api/submit-for-review", async (req, res) => {
  const { id, type, details, imageBase64 } = req.body;
  if (!id) return res.status(400).json({ error: "Missing submission ID" });

  submissions.set(id, { status: 'under_review', details, imageBase64 });

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
        if (imageBase64.startsWith('http')) {
          await bot.sendPhoto(chatId, imageBase64, { caption: message, ...inlineKeyboard });
        } else {
          const buffer = Buffer.from(imageBase64.split(',')[1] || imageBase64, 'base64');
          await bot.sendPhoto(chatId, buffer, { caption: message, ...inlineKeyboard });
        }
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
    setTimeout(async () => {
      const sub = submissions.get(id);
      if (sub) {
        if (sub.imageBase64 && sub.imageBase64.startsWith('data:image')) {
          console.log(`[Review] Uploading image for auto-approved submission ${id}...`);
          const url = await uploadToBunny(sub.imageBase64);
          if (url) {
            sub.details = sub.details || {};
            sub.details.photoDataUrl = url;
          } else {
             console.log(`[Review] BunnyCDN fail, falling back to base64...`);
             sub.details = sub.details || {};
             sub.details.photoDataUrl = sub.imageBase64;
          }
        }
        sub.status = 'approved';
      }
    }, 5000);
  }

  res.json({ success: true, status: 'under_review' });
});

app.get("/api/submission-status/:id", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const sub = submissions.get(req.params.id);
  if (!sub) return res.status(404).json({ error: "Not found" });
  res.json({ status: sub.status, details: sub.status === 'approved' ? sub.details : undefined });
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
