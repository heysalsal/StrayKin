const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Insert admin import
if (!serverCode.includes("import admin from")) {
    serverCode = serverCode.replace('import { initializeApp } from "firebase/app";', 'import { initializeApp } from "firebase/app";\nimport admin from "firebase-admin";');
}

// Insert admin initialization
const adminInit = `
try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: "ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d"
    });
  }
} catch (e) {
  console.error("Firebase admin init error", e);
}
`;

if (!serverCode.includes('admin.initializeApp')) {
    serverCode = serverCode.replace('// Initialize Firebase', adminInit + '\n// Initialize Firebase');
}

const newEndpoint = `
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
          body: \`There are \${straysFound} stray(s) reported near your current location.\`
        },
        token: fcmToken
      };

      await admin.messaging().send(message);
      console.log(\`Notification sent to \${fcmToken}\`);
      return res.json({ success: true, message: "Notification sent", straysFound });
    } else {
      return res.json({ success: true, message: "No strays nearby", straysFound: 0 });
    }
  } catch (error) {
    console.error("Location tracking error:", error);
    return res.status(500).json({ error: "Failed to process location" });
  }
});
`;

if (!serverCode.includes('/api/location')) {
    serverCode = serverCode.replace('async function startServer()', newEndpoint + '\nasync function startServer()');
}

fs.writeFileSync('server.ts', serverCode);
