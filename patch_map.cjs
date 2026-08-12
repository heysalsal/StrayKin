const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf-8');

let target = `      // Save locally to show in list as under review (don't save huge base64 string to firestore)
      if (selectedCatId) {
        const checkInRes = await addCheckInLog({
          catId: selectedCatId,
          wasFed: details.wasFed,
          healthStatus: (details as any).healthStatus || "Good",
          notes: details.notes || "",
          geo_point: null,
          photoDataUrl: null, // Defer image save to avoid Firestore limits until approved
          status: "under_review",
          submissionId,
          submittedBy: user?.uid,
        });
        docIdForReview = checkInRes.id;
        (reqBody.details as any).checkInId = checkInRes.id;
      } else {
        const res = await logNewSighting(
          lat,
          lng,
          geohash,
          {
            ...details,
            photoDataUrl: null,
            status: "under_review",
            submissionId,
            submittedBy: user?.uid,
          },
          true,
        );`;

let replacement = `      // Save locally to show in list as under review
      if (selectedCatId) {
        const checkInRes = await addCheckInLog({
          catId: selectedCatId,
          wasFed: details.wasFed,
          healthStatus: (details as any).healthStatus || "Good",
          notes: details.notes || "",
          geo_point: null,
          photoDataUrl: photoDataUrl, // Send image to cache preview while under review
          status: "under_review",
          submissionId,
          submittedBy: user?.uid,
        });
        docIdForReview = checkInRes.id;
        (reqBody.details as any).checkInId = checkInRes.id;
      } else {
        const res = await logNewSighting(
          lat,
          lng,
          geohash,
          {
            ...details,
            photoDataUrl: photoDataUrl, // Send image to cache preview while under review
            status: "under_review",
            submissionId,
            submittedBy: user?.uid,
          },
          true,
        );`;

code = code.replace(target, replacement);

target = `        checkIsAnimal(finalImageSrc).then(({ isValid, message }) => {
            if (!isValid) {
                console.warn("Final AI check failed:", message);
                if (reqBody.details.catId) {
                    updateCatSighting(reqBody.details.catId, { status: "rejected", aiRejectionReason: message });
                }`;

replacement = `        checkIsAnimal(finalImageSrc).then(({ isValid, message }) => {
            if (!isValid) {
                console.warn("Final AI check failed:", message);
                // Delete the temporary Firestore document if rejected
                import('firebase/firestore').then(({ deleteDoc, doc }) => {
                    import('../config/firebase').then(({ db }) => {
                        const coll = reqBody.type === "check_in" ? "check_ins" : "strays";
                        deleteDoc(doc(db, coll, docIdForReview));
                    });
                });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/MapView.tsx', code);
