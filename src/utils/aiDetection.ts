import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { getPendingSubmissions, removePendingSubmission } from './aiQueue';

let cachedModel: cocoSsd.ObjectDetection | null = null;
let modelPromise: Promise<cocoSsd.ObjectDetection> | null = null;

export const isModelReady = () => cachedModel !== null;

export const preloadAiModel = async () => {
  if (cachedModel) return;
  if (modelPromise) return modelPromise;
  
  console.log("Preloading COCO-SSD model in background...");
  
  let config = undefined;
  if (typeof window !== 'undefined' && (window as any).AndroidLauncher && typeof (window as any).AndroidLauncher.getAiModelUrl === 'function') {
    const localUrl = (window as any).AndroidLauncher.getAiModelUrl();
    if (localUrl) {
      console.log("Using local AI model URL provided by Android:", localUrl);
      config = { modelUrl: localUrl };
    }
  }

  modelPromise = cocoSsd.load(config);
  try {
    cachedModel = await modelPromise;
    console.log("Model preloaded successfully.");
  } catch (error) {
    console.error("Failed to preload model:", error);
  } finally {
    processAiQueue();
  }
};

export const processAiQueue = async () => {
  try {
    const pending = await getPendingSubmissions();
    if (pending.length === 0) return;
    
    console.log(`Processing ${pending.length} pending submissions...`);
    for (const sub of pending) {
      console.log(`AI checking pending submission ${sub.id}`);
      const { isValid, message, error } = await checkIsAnimal(sub.imageSrc);
      
      if (isValid || error) {
        // Submit to backend
        try {
          const res = await fetch("/api/submit-for-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub.reqBody),
          });
          if (!res.ok) throw new Error("Server returned " + res.status);
          const data = await res.json();
          
          if (sub.reqBody.details?.catId) {
            const { updateDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../config/firebase');
            await updateDoc(doc(db, "strays", sub.reqBody.details.catId), { 
               status: data.status,
               isCheckIn: sub.reqBody.type === "check_in",
               addToGallery: sub.reqBody.details.addToGallery,
               ...(data.imageUrl ? { photoDataUrl: data.imageUrl } : {})
            });
            
            // Also update check_in document if applicable
            if (sub.reqBody.details?.checkInId) {
              await updateDoc(doc(db, "check_ins", sub.reqBody.details.checkInId), { 
                 status: data.status,
                 ...(data.imageUrl ? { photoDataUrl: data.imageUrl } : {})
              }).catch(() => {});
            }
          }
          await removePendingSubmission(sub.id);
        } catch (e) {
          console.error("Failed to submit pending request, will retry later", e);
          continue; // Skip removal, retry later
        }
      } else {
        // Not an animal
        console.warn(`Pending submission ${sub.id} failed AI check: ${message}`);
        
        // Delete the firestore doc so it's not sent to the database
        if (sub.reqBody.docIdForReview) {
            const { deleteDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../config/firebase');
            const coll = sub.reqBody.type === "check_in" ? "check_ins" : "strays";
            await deleteDoc(doc(db, coll, sub.reqBody.docIdForReview));
        }
        
        // Notify user if possible
        if (typeof window !== 'undefined' && (window as any).AndroidLauncher && typeof (window as any).AndroidLauncher.showToast === 'function') {
           (window as any).AndroidLauncher.showToast("Your recent submission was rejected: " + message);
        } else if (typeof window !== 'undefined') {
           // Not ideal for background but okay for PWA if they are still on page
           alert("Your recent submission was rejected: " + message);
        }
        await removePendingSubmission(sub.id);
      }
    }
  } catch (e) {
    console.error("Error processing AI queue", e);
  }
};

export const checkIsAnimal = async (imageSrc: string): Promise<{isValid: boolean, message: string, error?: boolean}> => {
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageSrc;
    });

    if (!cachedModel) {
      if (modelPromise) {
        console.log("Waiting for model to finish loading...");
        cachedModel = await modelPromise;
      } else {
        console.log("Loading COCO-SSD model...");
        let config = undefined;
        if (typeof window !== 'undefined' && (window as any).AndroidLauncher && typeof (window as any).AndroidLauncher.getAiModelUrl === 'function') {
          const localUrl = (window as any).AndroidLauncher.getAiModelUrl();
          if (localUrl) {
            config = { modelUrl: localUrl };
          }
        }
        cachedModel = await cocoSsd.load(config);
        console.log("Model loaded.");
      }
    }
    
    console.log("Detecting objects...");
    const predictions = await cachedModel.detect(img, 20, 0.3); // Lower threshold to 0.3 to detect animals even if partially obscured
    console.log("Predictions:", predictions);
    
    const animalClasses = ['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'];
    
    const hasAnimal = predictions.some(p => animalClasses.includes(p.class));
    
    if (!hasAnimal) {
      return { isValid: false, message: `No animal detected in the photo. (Found: ${predictions.map(p => p.class).join(', ') || 'nothing'}) Please try again.` };
    }

    return { isValid: true, message: 'Animal detected successfully!' };
  } catch (error) {
    console.error("AI Detection failed:", error);
    return { isValid: false, message: 'AI model failed to load or process the image. Please wait for the download to finish or check your connection.', error: true };
  }
};
