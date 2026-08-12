const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf-8');

const target = `      if (useAiDetection && !isModelReady()) {
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

const replacement = `      if (useAiDetection && !isModelReady()) {
        console.log("Queueing submission for background AI check...");
        addPendingSubmission({
           id: submissionId,
           imageSrc: photoDataUrl || reqBody.imageBase64,
           reqBody: { ...reqBody, docIdForReview },
           timestamp: Date.now()
        });
      } else if (useAiDetection && isModelReady()) {
        // The model finished loading while the user was filling out the form, 
        // or we just want to be absolutely sure.
        console.log("Model is ready, performing final AI check before submission...");
        const { isValid, message } = await checkIsAnimal(photoDataUrl || reqBody.imageBase64);
        if (!isValid) {
            console.warn("Final AI check failed:", message);
            if (reqBody.details.catId) {
                updateCatSighting(reqBody.details.catId, { status: "rejected", aiRejectionReason: message });
            }
            if (typeof window !== 'undefined' && (window as any).AndroidLauncher && typeof (window as any).AndroidLauncher.showToast === 'function') {
                (window as any).AndroidLauncher.showToast("Your submission was rejected: " + message);
            } else {
                alert("Your submission was rejected: " + message);
            }
            setIsSubmitting(false);
            setIsModalOpen(false);
            return;
        }
        
        // It passed, send to server
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
      } else {
        // AI detection is disabled
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
      
code = code.replace(target, replacement);
fs.writeFileSync('src/components/MapView.tsx', code);
