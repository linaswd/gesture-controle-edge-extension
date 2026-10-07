import { HandLandmarker, FilesetResolver } from "./lib/vision_bundle.mjs";

const video  = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");
const status = document.getElementById("status");

const TASK_URL = chrome.runtime.getURL("hand_landmarker.task");
const WASM_URL = chrome.runtime.getURL("lib/");

let settings = {
  debounceMs: 900,
  mappings: {
    one_finger:    "scroll_down",
    two_fingers:   "scroll_up",
    three_fingers: "arrow_right",
    thumbs_up:     "arrow_left",
    pinch:         "left_click",
    fist:          "none",
  }
};

let lastGestureId = null, lastSentAt = 0;
let consecutive = {};
const STABLE = 6;        // more frames = less false triggers
const COOLDOWN_MS = 1200; // after firing, ignore all gestures for 1.2s
let lastFiredAt = 0;
window._gestureArmed = true; // start armed so first gesture works

chrome.storage.local.get("gestureSettings", (d) => {
  if (d.gestureSettings) settings = { ...settings, ...d.gestureSettings };
});

setStatus("Requesting camera…");
try {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 320, height: 240, facingMode: "user" }
  });
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
  video.play();
} catch(e) {
  setStatus("❌ Camera denied");
  notify({ type: "CAMERA_ERROR", error: e.message });
  throw e;
}

setStatus("Loading model…");
let landmarker;
try {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  landmarker = await HandLandmarker.createFromModelPath(vision, TASK_URL);
  landmarker.setOptions({ numHands: 1, runningMode: "VIDEO" });
  setStatus("✋ Ready!");
  notify({ type: "CAMERA_READY" });
} catch(e) {
  setStatus("❌ " + e.message);
  notify({ type: "CAMERA_ERROR", error: e.message });
  throw e;
}

const LABELS = {
  one_finger:    "☝️ Scroll Down",
  two_fingers:   "✌️ Scroll Up",
  three_fingers: "🤟 → Right",
  thumbs_up:     "👍 ← Left",
  pinch:         "🤌 Click",
};

function loop() {
  requestAnimationFrame(loop);
  if (video.readyState < 2) return;

  // Sync canvas to window size (not video resolution) so it covers the screen correctly
  const W = window.innerWidth  || 640;
  const H = window.innerHeight || 480;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width  = W;
    canvas.height = H;
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
  }
  ctx.clearRect(0, 0, W, H);

  const results = landmarker.detectForVideo(video, performance.now());

  if (!results.landmarks?.length) {
    consecutive = {};
    setStatus("✋ Show your hand!");
    notify({ type: "GESTURE_UPDATE", gestureId: null });
    return;
  }

  const lm = results.landmarks[0];
  drawHand(lm);                    // ← draws landmarks on canvas
  const gestureId = classify(lm);

  if (gestureId === "fist") {
    // Fist = intentional stop — reset everything, fire nothing
    consecutive = {};
    lastGestureId = null;
    setStatus("✊ Pause — release to gesture");
    notify({ type: "GESTURE_UPDATE", gestureId: null });
    return;
  }

  if (gestureId) {
    consecutive[gestureId] = (consecutive[gestureId] ?? 0) + 1;
    Object.keys(consecutive).forEach(k => { if (k !== gestureId) consecutive[k] = 0; });
  } else {
    consecutive = {};
  }

  const stable = gestureId && consecutive[gestureId] >= STABLE;
  notify({ type: "GESTURE_UPDATE", gestureId: stable ? gestureId : null });

  if (stable) {
    setStatus((LABELS[gestureId] ?? gestureId) + " 🔥");
    dispatch(gestureId, lm);
  } else if (gestureId) {
    setStatus(`${LABELS[gestureId] ?? gestureId} — hold… ${consecutive[gestureId]}/${STABLE}`);
  } else {
    setStatus("Hand seen…");
  }
}
loop();

function classify(lm) {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const ext = tips.map((t, i) => lm[t].y < lm[pips[i]].y - 0.04);
  const n = ext.filter(Boolean).length;

  // Pinch: distance between thumb tip (4) and index tip (8) is very small
  const dx = lm[4].x - lm[8].x;
  const dy = lm[4].y - lm[8].y;
  const pinchDist = Math.sqrt(dx*dx + dy*dy);
  if (pinchDist < 0.06) return "pinch";

  // Thumbs up: thumb tip well above wrist, all fingers curled
  const thumbTipY = lm[4].y;
  const wristY    = lm[0].y;
  const thumbUp   = thumbTipY < wristY - 0.1 && n === 0;
  if (thumbUp)                                  return "thumbs_up";

  // Fist: no fingers extended (explicitly detected and mapped to "none")
  if (n === 0)                                  return "fist";

  if (n === 1 && ext[0])                        return "one_finger";
  if (n === 2 && ext[0] && ext[1])              return "two_fingers";
  if (n === 3 && ext[0] && ext[1] && ext[2])    return "three_fingers";
  return null;
}

// ── Draw 21 landmarks + connections ──────────────────────────────────────────
const CONN = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

function drawHand(lm) {
  const W = window.innerWidth  || canvas.width;
  const H = window.innerHeight || canvas.height;

  // Draw connections
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 2;
  for (const [a, b] of CONN) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * W, lm[a].y * H);
    ctx.lineTo(lm[b].x * W, lm[b].y * H);
    ctx.stroke();
  }

  // Draw dots
  for (let i = 0; i < lm.length; i++) {
    const isTip = [4, 8, 12, 16, 20].includes(i);
    ctx.beginPath();
    ctx.arc(lm[i].x * W, lm[i].y * H, isTip ? 6 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isTip ? "#ff3333" : "#534AB7";
    ctx.fill();
  }
}

// Track index fingertip position (landmark 8) for click targeting
let pointerX = 0.5, pointerY = 0.5;

function dispatch(gestureId, lm) {
  const now = Date.now();
  // Ignore during cooldown (transition between gestures)
  if (now - lastFiredAt < COOLDOWN_MS && gestureId !== lastGestureId) return;
  if (gestureId === lastGestureId && now - lastSentAt < settings.debounceMs) return;
  lastGestureId = gestureId; lastSentAt = now; lastFiredAt = now;
  const action = settings.mappings?.[gestureId] ?? gestureId;
  if (!action || action === "none") return;
  // Send normalized index fingertip position for click targeting
  // Note: x is mirrored because video is flipped
  notify({ type: "DISPATCH_GESTURE", gestureId, action,
    pointerX: 1 - (lm[8].x), pointerY: lm[8].y });
}

function notify(msg) {
  try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch(e) {}
}
function setStatus(t) { if (status) status.textContent = t; }
