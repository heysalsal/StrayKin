import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import TelegramBot from "node-telegram-bot-api";
import { initializeApp } from "firebase/app";
import { getApps, initializeApp as adminInitializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore, doc, updateDoc, getDoc, collection, query as fsQuery, where, getDocs, setDoc } from "firebase/firestore";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));


try {
  if (getApps().length === 0) {
    adminInitializeApp({
      projectId: "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d"
    });
  }
} catch (e) {
  console.error("Firebase admin init error", e);
}

// Initialize Firebase
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const firebaseApp = initializeApp(config);
    const dbId = "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d";
    db = getFirestore(firebaseApp, dbId);
  }
} catch (e) {
  console.error("Failed to initialize firebase in server", e);
}

// Bunny.net config extraction
async function uploadToBunny(imageBase64: string): Promise<string | null> {
  try {
    const accessKey = process.env.BUNNY_API_KEY;
    if (!accessKey) {
        console.warn("[Bunny] BUNNY_API_KEY is not defined. Skipping upload.");
        return null;
    }
    const zoneName = process.env.BUNNY_ZONE_NAME || "straykin";
    let region = process.env.BUNNY_REGION || "";
    
    // Clean up user input if they pasted a full URL
    region = region.replace(/^https?:\/\//, "");
    region = region.split("/")[0];

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
      if (response.status === 401) {
         console.warn("[Review] Bunny API Key incorrect or missing. Falling back to Firestore storage.");
         return null;
      }
      console.error("Bunny upload failed:", respText);
      return null;
    }
  } catch (error: any) {
    console.error("Bunny API error:", error);
    return null;
  }
}

async function handleSubmissionApproval(db: any, id: string, action: string, imageUrl?: string, docIdForReview?: string, type?: string, details?: any) {
    try {
      // If we have docIdForReview, forcefully update the status
      if (docIdForReview) {
          const collName = type === "check_in" ? "check_ins" : (type === "hub_proposal" ? "hubs" : "strays");
          
          let updatePayload: any = { status: action === "approve" ? "approved" : "rejected" };
          
          if (imageUrl && action === "approve") {
              if (collName === "strays") updatePayload.imageUrl = imageUrl;
              else if (collName === "check_ins") { updatePayload.photoDataUrl = imageUrl; updatePayload.imageUrl = imageUrl; }
              else if (collName === "hubs") updatePayload.photoUrl = imageUrl;
          }
          
          await setDoc(doc(db, collName, docIdForReview), updatePayload, { merge: true });

          // Also update the parent stray or pet if it was a check_in
          if (type === "check_in" && details?.catId && action === "approve") {
              const catUpdate: any = { 
                  status: "approved",
              };
              
              const nowSeconds = Math.floor(Date.now() / 1000);
              catUpdate["last_check_in.timestamp"] = { seconds: nowSeconds, nanoseconds: 0, _seconds: nowSeconds, _nanoseconds: 0 };
              
              if (details.wasFed !== undefined) catUpdate["last_check_in.was_fed"] = details.wasFed;
              
              if (details.activities && Array.isArray(details.activities)) {
                  catUpdate["last_check_in.activities"] = details.activities;
              } else {
                  const acts = [];
                  if (details.wasFed) acts.push("Feed");
                  if (acts.length > 0) catUpdate["last_check_in.activities"] = acts;
              }

              if (details.notes) {
                  catUpdate["last_check_in.notes"] = details.notes;
              } else if (details.healthStatus && details.healthStatus !== "Good") {
                  catUpdate["last_check_in.notes"] = details.healthStatus;
              }

              let catRef = doc(db, "strays", details.catId);
              try {
                  let catSnap = await getDoc(catRef);
                  if (!catSnap.exists()) {
                      catRef = doc(db, "pets", details.catId);
                      catSnap = await getDoc(catRef);
                  }
                  if (catSnap.exists()) {
                      const catData = catSnap.data();
                      if (details.addToGallery && imageUrl) {
                          let newGallery = [...(catData.gallery || [])];
                          if (!newGallery.find(g => g.url === imageUrl)) {
                              newGallery.push({
                                  id: Date.now().toString(),
                                  url: imageUrl,
                                  timestamp: Date.now(),
                                  votes: 0,
                                  submittedBy: details.submittedBy || 'anonymous'
                              });
                              newGallery.sort((a: any, b: any) => b.votes - a.votes || b.timestamp - a.timestamp);
                              if (newGallery.length > 10) newGallery = newGallery.slice(0, 10);
                              catUpdate.gallery = newGallery;
                          }
                      }
                  }
                  await updateDoc(catRef, catUpdate);
              } catch (e: any) {
                  // Fallback
                  try { await updateDoc(doc(db, "strays", details.catId), catUpdate); } catch(e2){}
              }
          }
      }

      // Query-based fallback/supplement just in case
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

                 if (d.addToGallery && finalImageUrl) {
                     try {
                         const catSnap = await getDoc(catRef);
                         if (catSnap.exists()) {
                             const catData = catSnap.data();
                             let newGallery = [...(catData.gallery || [])];
                             if (!newGallery.find(g => g.url === finalImageUrl)) {
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
                     } catch(e) {}
                 }

                 try {
                     await updateDoc(catRef, catUpdate);
                 } catch (e: any) {
                     if (e.code === 'not-found') {
                         try {
                             await updateDoc(doc(db, "pets", d.catId), catUpdate);
                         } catch (e2) {}
                     }
                 }
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
    } else if (error.code === "EFATAL" || (error.message && (error.message.includes("ECONNRESET") || error.message.includes("socket hang up")))) {
      // Ignore connection resets, the bot will auto-reconnect
    } else {
      console.error("Telegram polling error:", error);
    }
  });
  bot.on("error", (error: any) => {
    console.error("Telegram general error:", error);
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
  const { id, type, details, imageBase64, docIdForReview } = req.body;
  if (!id) return res.status(400).json({ error: "Missing submission ID" });

  let uploadedUrl = null;
  if (imageBase64 && imageBase64.startsWith("data:image")) {
     console.log(`[Review] Starting Bunny upload for ${id}...`);
     uploadedUrl = await uploadToBunny(imageBase64);
     if (uploadedUrl && db) {
        try {
            console.log(`[Review] Uploaded to bunny, updating Firestore...`);
            const coll = type === "check_in" ? "check_ins" : (type === "hub_proposal" ? "hubs" : "strays");
            
            let updatePayload: any = { imageUrl: uploadedUrl };
            if (coll === "check_ins") updatePayload = { photoDataUrl: uploadedUrl, imageUrl: uploadedUrl };
            if (coll === "hubs") updatePayload = { photoUrl: uploadedUrl };

            if (docIdForReview) {
                await setDoc(doc(db, coll, docIdForReview), updatePayload, { merge: true });
            }

            const snap = await getDocs(fsQuery(collection(db, coll), where("submissionId", "==", id)));
            for (const d of snap.docs) {
               if (d.id !== docIdForReview) {
                  await setDoc(doc(db, coll, d.id), updatePayload, { merge: true });
               }
            }
        } catch(e) {
            console.error("[Review] Failed to update firestore image", e);
        }
     } else if (!uploadedUrl) {
        console.warn(`[Review] bunny upload returned null, fallback to firestore base64`);
     }
  }

  const autoApprove = process.env.AUTO_APPROVE_SUBMISSIONS !== "false" && type !== "hub_proposal";

  // Always auto-approve the submission immediately directly via Firebase
  if (autoApprove && db) {
      console.log(`[Review] Auto-approving submission ${id}. with docIdForReview=${docIdForReview}`);
      try {
        await handleSubmissionApproval(db, id, "approve", uploadedUrl || imageBase64, docIdForReview, type, details);
        console.log(`[Review] Auto-approve complete for ${id}`);
      } catch (e) {
        console.error(`[Review] Error during handleSubmissionApproval for ${id}:`, e);
      }
  } else if (!autoApprove && db) {
      console.log(`[Review] Auto-approve is disabled, submission ${id} left as under_review.`);
  } else {
      console.warn(`[Review] No db configured, skipping auto-approval`);
  }

  if (bot && chatId) {
    try {
      const catIdStr = details?.catId ? `\nCat ID: ${details.catId}` : "";
      const urlStr = uploadedUrl ? `\nFile URL: ${uploadedUrl}` : "";
      const isApproved = autoApprove;
      let message = `${isApproved ? "Auto-Approved " : "New "}${type === "check_in" ? "Check-in" : (type === "hub_proposal" ? "Hub Proposal" : "Straykin")} Submission! 🐱\nSubmission ID: ${id}${catIdStr}${urlStr}\nDetails: ${JSON.stringify(details, null, 2)}`;
      if (message.length > 1000) message = message.substring(0, 1000) + "...";

      const keyboard = isApproved ? [] : [
          [
            { text: "✅ Approve", callback_data: `approve_${id}` },
            { text: "❌ Reject", callback_data: `reject_${id}` },
          ],
        ];

      const imageToSend = uploadedUrl || imageBase64;
      if (imageToSend) {
        if (imageToSend.startsWith("http")) {
          await bot.sendPhoto(chatId, imageToSend, {
            caption: message,
            reply_markup: { inline_keyboard: keyboard },
          });
        } else {
          const buffer = Buffer.from(
            imageToSend.split(",")[1] || imageToSend,
            "base64",
          );
          await bot.sendPhoto(chatId, buffer, {
            caption: message,
            reply_markup: { inline_keyboard: keyboard },
          }, {
            filename: 'submission.jpg',
            contentType: 'image/jpeg'
          });
        }
      } else {
        await bot.sendMessage(chatId, message, {
           reply_markup: { inline_keyboard: keyboard },
        });
      }
    } catch (e: any) {
      console.error("Failed to send telegram message:", e.message || e);
    }
  }

  res.json({ success: true, status: autoApprove ? "approved" : "under_review", imageUrl: uploadedUrl });
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


app.post("/api/location", async (req, res) => {
  const { latitude, longitude, fcmToken } = req.body;
  
  if (!latitude || !longitude || !fcmToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const now = new Date();
  const hours = now.getHours();
  
  const isMorningWindow = hours >= 11 && hours < 13;
  const isEveningWindow = hours >= 16 && hours < 20;

  if (!isMorningWindow && !isEveningWindow) {
    return res.json({ success: true, message: "Outside notification window" });
  }

  if (!db) {
    return res.status(500).json({ error: "DB not initialized" });
  }

  try {
    const { geohashQueryBounds, distanceBetween } = await import("geofire-common");
    const radiusInM = 1000; // 1km
    const center = [latitude, longitude];
    const bounds = geohashQueryBounds(center, radiusInM);

    const promises = [];
    for (const b of bounds) {
      const q = fsQuery(
        collection(db, 'strays'),
        where('geohash', '>=', b[0]),
        where('geohash', '<=', b[1])
      );
      promises.push(getDocs(q));
    }

    const snapshots = await Promise.all(promises);
    let straysFound = 0;
    
    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        const cat = doc.data();
        if (cat.lat && cat.lng) {
          const distanceInKm = distanceBetween([cat.lat, cat.lng], center);
          const distanceInM = distanceInKm * 1000;
          if (distanceInM <= radiusInM) {
            straysFound++;
          }
        }
      }
    }

    if (straysFound > 0) {
      const message = {
        notification: {
          title: "Strays Nearby!",
          body: `There are ${straysFound} stray(s) reported near your current location.`
        },
        token: fcmToken
      };

      await getMessaging().send(message);
      console.log(`Notification sent to ${fcmToken}`);
      return res.json({ success: true, message: "Notification sent", straysFound });
    } else {
      return res.json({ success: true, message: "No strays nearby", straysFound: 0 });
    }
  } catch (error) {
    console.error("Location tracking error:", error);
    return res.status(500).json({ error: "Failed to process location" });
  }
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
