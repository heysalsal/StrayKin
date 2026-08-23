const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace('import admin from "firebase-admin";', 'import { getApps, initializeApp as adminInitializeApp } from "firebase-admin/app";\nimport { getMessaging } from "firebase-admin/messaging";');

code = code.replace('if (admin.apps.length === 0) {', 'if (getApps().length === 0) {');
code = code.replace('admin.initializeApp({', 'adminInitializeApp({');
code = code.replace('await admin.messaging().send(message);', 'await getMessaging().send(message);');

fs.writeFileSync('server.ts', code);
