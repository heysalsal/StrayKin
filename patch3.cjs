const fs = require('fs');
let lines = fs.readFileSync('src/components/MapView.tsx', 'utf-8').split('\n');

const replacement = `      if (useAiDetection && !isModelReady()) {
        console.log("Queueing submission for background AI check...");
        addPendingSubmission({
           id: submissionId,
           imageSrc: photoDataUrl || reqBody.imageBase64,
           reqBody: { ...reqBody, docIdForReview },
           timestamp: Date.now()
        });
      } else {
        fetch("/api/submit-for-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...reqBody, docIdForReview }),
        })
        .then(res => res.json())
        .then(data => {
          if (reqBody.details.catId) {
            updateCatSighting(reqBody.details.catId, { 
               status: data.status,
              isCheckIn: reqBody.type === "check_in",
              addToGallery: reqBody.details.addToGallery,
              ...(data.imageUrl ? { photoDataUrl: data.imageUrl } : {})
            });
          }
        })
        .catch(err => console.error("Background review failed", err));
      }`;

lines.splice(880, 17, replacement);
fs.writeFileSync('src/components/MapView.tsx', lines.join('\n'));
