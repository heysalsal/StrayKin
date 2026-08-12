const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf-8');
const target = `      fetch("/api/submit-for-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reqBody, docIdForReview }),
      })
      .then(res => res.json())
      .then(data => {
        if (reqBody.details.catId) {
          updateCatSighting(reqBody.details.catId, { 
             status: data.status, // might be 'approved' or 'under_review'
            isCheckIn: reqBody.type === "check_in",
            addToGallery: reqBody.details.addToGallery,
            ...(data.imageUrl ? { photoDataUrl: data.imageUrl } : {})
          });
        }
      })
      .catch(err => console.error("Background review failed", err));`;

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
               status: data.status, // might be 'approved' or 'under_review'
              isCheckIn: reqBody.type === "check_in",
              addToGallery: reqBody.details.addToGallery,
              ...(data.imageUrl ? { photoDataUrl: data.imageUrl } : {})
            });
          }
        })
        .catch(err => console.error("Background review failed", err));
      }`;
code = code.replace(target, replacement);
fs.writeFileSync('src/components/MapView.tsx', code);
