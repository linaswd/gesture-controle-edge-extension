// Loads vision_bundle.mjs and exposes HandLandmarker + FilesetResolver as globals
// This script itself must be loaded as type="module"
import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";
window.HandLandmarker = HandLandmarker;
window.FilesetResolver = FilesetResolver;
window.__visionReady = true;
document.dispatchEvent(new Event("visionReady"));
