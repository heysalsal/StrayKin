import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

let cachedModel: cocoSsd.ObjectDetection | null = null;
let modelPromise: Promise<cocoSsd.ObjectDetection> | null = null;

export const preloadAiModel = async () => {
  if (cachedModel) return;
  if (modelPromise) return modelPromise;
  
  console.log("Preloading COCO-SSD model in background...");
  modelPromise = cocoSsd.load();
  try {
    cachedModel = await modelPromise;
    console.log("Model preloaded successfully.");
  } catch (error) {
    console.error("Failed to preload model:", error);
  }
};

export const checkIsAnimal = async (imageSrc: string): Promise<{isValid: boolean, message: string}> => {
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
        cachedModel = await cocoSsd.load();
        console.log("Model loaded.");
      }
    }
    
    console.log("Detecting objects...");
    const predictions = await cachedModel.detect(img);
    console.log("Predictions:", predictions);
    
    const animalClasses = ['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'];
    
    const hasAnimal = predictions.some(p => animalClasses.includes(p.class));
    const hasPerson = predictions.some(p => p.class === 'person');

    if (hasPerson) {
      return { isValid: false, message: 'Human detected in the photo. Please take a photo of the stray animal only.' };
    }
    
    if (!hasAnimal) {
      return { isValid: false, message: `No animal detected in the photo. (Found: ${predictions.map(p => p.class).join(', ') || 'nothing'}) Please try again.` };
    }

    return { isValid: true, message: 'Animal detected successfully!' };
  } catch (error) {
    console.error("AI Detection failed:", error);
    return { isValid: true, message: 'Detection failed, bypassing.' };
  }
};
