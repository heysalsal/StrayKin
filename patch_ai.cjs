const fs = require('fs');
let code = fs.readFileSync('src/utils/aiDetection.ts', 'utf-8');

let target = `        // Update firestore to rejected if we created a doc
        if (sub.reqBody.details?.catId) {
            const { updateDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../config/firebase');
            await updateDoc(doc(db, "strays", sub.reqBody.details.catId), { 
               status: "rejected",
               aiRejectionReason: message
            });
        }`;

let replacement = `        // Delete the firestore doc so it's not sent to the database
        if (sub.reqBody.docIdForReview) {
            const { deleteDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../config/firebase');
            const coll = sub.reqBody.type === "check_in" ? "check_ins" : "strays";
            await deleteDoc(doc(db, coll, sub.reqBody.docIdForReview));
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/utils/aiDetection.ts', code);
