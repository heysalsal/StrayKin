const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace('import admin from "firebase-admin";', 'import { getApps, initializeApp as adminInitializeApp } from "firebase-admin/app";\nimport { getMessaging } from "firebase-admin/messaging";');
content = content.replace('if (admin.apps.length === 0) {', 'if (getApps().length === 0) {');
content = content.replace('admin.initializeApp({', 'adminInitializeApp({');
content = content.replace('await admin.messaging().send(message);', 'await getMessaging().send(message);');
fs.writeFileSync('server.ts', content);
