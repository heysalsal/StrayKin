import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Firebase
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const firebaseApp = initializeApp(config);
    db = getFirestore(firebaseApp, config.firestoreDatabaseId || "(default)");
  }
} catch (e) {
  console.error("Failed to initialize firebase in server", e);
}

async function uploadToBunny(imageBase64: string): Promise<string | null> {
  try {
    const accessKey =
      process.env.BUNNY_API_KEY ||
      "eea8fffd-53b3-4080-bd99-3ef5d83ff9a13aaa1ec7-053b-4797-a824-e818158032e8";
    const zoneName = process.env.BUNNY_ZONE_NAME || "straykin";
    let region = process.env.BUNNY_REGION || "";
    let storageDomain = "storage.bunnycdn.com";

    if (region.includes("storage.bunnycdn.com")) {
      storageDomain = region;
    } else if (region) {
      storageDomain = `${region.endsWith(".") ? region : region + "."}storage.bunnycdn.com`;
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const fileName = `straykin_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    const url = `https://${storageDomain}/${zoneName}/images/${fileName}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        AccessKey: accessKey,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    });

    if (response.ok) {
      return `https://straykin.b-cdn.net/images/${fileName}`;
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

async function handleSubmissionApproval(db: any, id: string, action: string, imageUrl?: string) {
    try {
      const { collection, query: fsQuery, where, getDocs, getDoc, updateDoc, doc } = await import("firebase/firestore");
      
      // Update in strays
      const straysQ = fsQuery(collection(db, "strays"), where("submissionId", "==", id));
      const straysSnap = await getDocs(straysQ);
      for (const ds of straysSnap.docs) {
        if (ds.data().status === "under_review") {
            await updateDoc(ds.ref, { 
                status: action === "approve" ? "approved" : "rejected",
                ...(imageUrl && action === "approve" ? { imageUrl } : {}) 
            });
        }
      }

      // Update in check-ins
      const checkinsQ = fsQuery(collection(db, "check_ins"), where("submissionId", "==", id));
      const checkinsSnap = await getDocs(checkinsQ);
      for (const dc of checkinsSnap.docs) {
         if (dc.data().status === "under_review") {
             const updates: any = { status: action === "approve" ? "approved" : "rejected" };
             if (imageUrl && action === "approve") {
                 updates.photoDataUrl = imageUrl;
                 updates.imageUrl = imageUrl;
             }
             await updateDoc(dc.ref, updates);
             
             if (dc.data().catId && action === "approve") {
                 const d = dc.data();
                 const catRef = doc(db, "strays", d.catId);
                 const catUpdate: any = { status: "approved" };
                 if (d.timestamp) catUpdate["last_check_in.timestamp"] = d.timestamp;
                 if (d.wasFed !== undefined) catUpdate["last_check_in.was_fed"] = d.wasFed;
                 
                 const activities = [];
                 if (d.wasFed) activities.push("Feed");
                 if (activities.length > 0) catUpdate["last_check_in.activities"] = activities;
                 
                 if (d.healthStatus && d.healthStatus !== "Good") catUpdate["last_check_in.notes"] = d.healthStatus;
                 
                 const finalImageUrl = imageUrl || d.photoDataUrl || d.imageUrl;
                 if (finalImageUrl) catUpdate.imageUrl = finalImageUrl;

                 if (d.addToGallery && finalImageUrl) {
                     const catSnap = await getDoc(catRef);
                     if (catSnap.exists()) {
                         const catData = catSnap.data();
                         let newGallery = [...(catData.gallery || [])];
                         newGallery.push({
                           id: Date.now().toString(),
                           url: finalImageUrl,
                           timestamp: Date.now(),
                           votes: 0,
                           submittedBy: d.submittedBy
                         });
                         newGallery.sort((a: any, b: any) => b.votes - a.votes || b.timestamp - a.timestamp);
                         if (newGallery.length > 10) newGallery = newGallery.slice(0, 10);
                         catUpdate.gallery = newGallery;
                     }
                 }

                 await updateDoc(catRef, catUpdate);
             }
         }
      }
    } catch(e) {
      console.error("Failed to update firestore on approval", e);
    }
}

// Setup Telegram Bot if token exists
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot: TelegramBot | null = null;

if (token) {
  bot = new TelegramBot(token, { polling: true });
  console.log("Telegram bot initialized for manual review.");

  bot.on("polling_error", (error: any) => {
    if (error.code === "ETELEGRAM" && error.message.includes("409 Conflict")) {
      console.warn("Telegram polling conflict: Another instance is running.");
    } else if (error.code === "EFATAL" || (error.message && error.message.includes("ECONNRESET"))) {
      // Ignore connection resets, the bot will auto-reconnect
      console.warn("Telegram polling soft error (ECONNRESET). Auto-reconnecting...");
    } else {
      console.error("Telegram polling error:", error);
    }
  });

  process.once("SIGINT", () => bot?.stopPolling());
  process.once("SIGTERM", () => bot?.stopPolling());

  bot.on("callback_query", async (query) => {
    if (!query.data || !query.message) return;

    let action = "";
    let id = "";
    const firstColon = query.data.indexOf(":");
    if (firstColon !== -1) {
      action = query.data.substring(0, firstColon);
      id = query.data.substring(firstColon + 1);
    } else {
      const firstUnderscore = query.data.indexOf("_");
      if (firstUnderscore !== -1) {
        action = query.data.substring(0, firstUnderscore);
        id = query.data.substring(firstUnderscore + 1);
      } else {
        return;
      }
    }

    // 1. Immediate Acknowledgment
    bot?.answerCallbackQuery(query.id).catch(() => {});

    if (!db) {
       console.error("Firebase not initialized");
       return;
    }

    await handleSubmissionApproval(db, id, action);

    const newText =
      (query.message.text || query.message.caption || "Submission") +
      (action === "approve" ? "\n\n✅ Approved by Admin" : "\n\n❌ Rejected by Admin");
    
    if (query.message.photo) {
      bot
        ?.editMessageCaption(newText, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] },
        })
        .catch(() => {});
    } else {
      bot
        ?.editMessageText(newText, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] },
        })
        .catch(() => {});
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

app.get("/api/proxy-image", async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) return res.status(400).send("No url provided");
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return res.status(response.status).send("Failed to fetch image");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buffer);
  } catch (error) {
    res.status(500).send("Error proxying image");
  }
});

app.post("/api/submit-for-review", async (req, res) => {
  const { id, type, details, imageBase64 } = req.body;
  if (!id) return res.status(400).json({ error: "Missing submission ID" });

  let uploadedUrl = null;
  if (imageBase64 && imageBase64.startsWith("data:image")) {
     uploadedUrl = await uploadToBunny(imageBase64);
     if (uploadedUrl && db) {
        try {
            const { collection, query: fsQuery, where, getDocs } = await import("firebase/firestore");
            const coll = type === "check_in" ? "check_ins" : "strays";
            const snap = await getDocs(fsQuery(collection(db, coll), where("submissionId", "==", id)));
            for (const doc of snap.docs) {
               await updateDoc(doc.ref, { 
                   ...(coll === "strays" ? { imageUrl: uploadedUrl } : { photoDataUrl: uploadedUrl, imageUrl: uploadedUrl }) 
               });
               if (coll === "check_ins" && doc.data().catId) {
                   const { doc: fDoc } = await import("firebase/firestore");
                   const catRef = fDoc(db, "strays", doc.data().catId);
                   await updateDoc(catRef, { imageUrl: uploadedUrl });
               }
            }
        } catch(e) {
            console.error("Failed to update firestore image", e);
        }
     }
  }

  // Always auto-approve the submission immediately directly via Firebase
  if (db) {
      console.log(`[Review] Auto-approving submission ${id}`);
      await handleSubmissionApproval(db, id, "approve", uploadedUrl || undefined);
  }

  if (bot && chatId) {
    try {
      const catIdStr = details?.catId ? `\nCat ID: ${details.catId}` : "";
      const message = `Auto-Approved ${type === "check_in" ? "Check-in" : "Straykin"} Submission! 🐱\nSubmission ID: ${id}${catIdStr}\nDetails: ${JSON.stringify(details, null, 2)}`;

      const imageToSend = uploadedUrl || imageBase64;
      if (imageToSend) {
        if (imageToSend.startsWith("http")) {
          await bot.sendPhoto(chatId, imageToSend, {
            caption: message,
          });
        } else {
          const buffer = Buffer.from(
            imageToSend.split(",")[1] || imageToSend,
            "base64",
          );
          await bot.sendPhoto(chatId, buffer, {
            caption: message,
          });
        }
      } else {
        await bot.sendMessage(chatId, message);
      }
    } catch (e: any) {
      console.error("Failed to send telegram message:", e.message || e);
    }
  }

  res.json({ success: true, status: "approved" });
});

app.get("/api/submission-status/:id", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  if (!db) return res.status(404).json({ error: "Not found" });
  try {
     const { collection, query: fsQuery, where, getDocs } = await import("firebase/firestore");
     const snap = await getDocs(fsQuery(collection(db, "strays"), where("submissionId", "==", req.params.id)));
     if (!snap.empty) {
         const ds = snap.docs[0].data();
         res.json({ status: ds.status, details: ds });
         return;
     }

     const snap2 = await getDocs(fsQuery(collection(db, "check_ins"), where("submissionId", "==", req.params.id)));
     if (!snap2.empty) {
         const dc = snap2.docs[0].data();
         res.json({ status: dc.status, details: dc });
         return;
     }
  } catch(e) {}
  
  res.status(404).json({ error: "Not found" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
