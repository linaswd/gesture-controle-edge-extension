// gesture_engine.js — GestureControl
// Robust gesture classifier using MediaPipe 21-landmark output.

const FINGER_TIPS = [8, 12, 16, 20];  // index, middle, ring, pinky tips
const FINGER_PIPS = [6, 10, 14, 18];  // proximal joints (knuckles)
const FINGER_MCPS = [5,  9, 13, 17];  // base knuckles

function classifyGesture(lm) {
  if (!lm || lm.length < 21) return { gestureId: null, confidence: 0 };

  // ── How many fingers are extended? ─────────────────────────────────────────
  // A finger is extended if its tip is significantly above its PIP joint (y axis inverted)
  const extended = FINGER_TIPS.map((tip, i) => {
    const dy = lm[FINGER_PIPS[i]].y - lm[tip].y; // positive = tip above pip
    return dy > 0.04; // at least 4% of image height above pip
  });
  const extCount = extended.filter(Boolean).length;

  // ── Thumb ──────────────────────────────────────────────────────────────────
  // Use x-distance: thumb tip should be far from index MCP
  const thumbTip  = lm[4];
  const thumbIp   = lm[3];
  const thumbMcp  = lm[2];
  const indexMcp  = lm[5];

  // Thumb extended: tip is to the left of IP joint (mirrored webcam)
  const thumbExtended = Math.abs(thumbTip.x - indexMcp.x) > 0.08;

  // Thumb pointing up: tip is well above MCP, and not just extended sideways
  const thumbUp = thumbTip.y < thumbMcp.y - 0.06 && thumbExtended;

  // ── Classify ───────────────────────────────────────────────────────────────

  // THUMBS UP — thumb up, all fingers curled
  if (thumbUp && extCount === 0) {
    return { gestureId: "thumbs_up", confidence: 0.94 };
  }

  // FIST — nothing extended (thumb may or may not be tucked)
  if (extCount === 0 && !thumbUp) {
    return { gestureId: "fist", confidence: 0.96 };
  }

  // OPEN HAND — all 4 fingers extended
  if (extCount === 4) {
    return { gestureId: "open_hand", confidence: 0.92 };
  }

  // ONE FINGER — only index extended
  if (extCount === 1 && extended[0]) {
    return { gestureId: "one_finger", confidence: 0.93 };
  }

  // TWO FINGERS — index + middle
  if (extCount === 2 && extended[0] && extended[1]) {
    return { gestureId: "two_fingers", confidence: 0.90 };
  }

  // THREE FINGERS — index + middle + ring
  if (extCount === 3 && extended[0] && extended[1] && extended[2]) {
    return { gestureId: "three_fingers", confidence: 0.87 };
  }

  // FOUR FINGERS — index + middle + ring + pinky (no thumb)
  if (extCount === 4 && !thumbExtended) {
    return { gestureId: "four_fingers", confidence: 0.85 };
  }

  return { gestureId: null, confidence: 0 };
}

function getGestureMeta(gestureId) {
  const map = {
    fist:          { emoji: "✊", label: "Fist",        description: "Pause / Stop" },
    open_hand:     { emoji: "🤚", label: "Open hand",  description: "Fullscreen" },
    thumbs_up:     { emoji: "👍", label: "Thumbs up",  description: "Like" },
    one_finger:    { emoji: "☝️", label: "1 finger",   description: "Next" },
    two_fingers:   { emoji: "✌️", label: "2 fingers",  description: "Previous" },
    three_fingers: { emoji: "🤟", label: "3 fingers",  description: "Custom" },
    four_fingers:  { emoji: "🖖", label: "4 fingers",  description: "Custom" },
  };
  return map[gestureId] ?? { emoji: "❓", label: gestureId, description: "–" };
}

class GestureDebouncer {
  constructor(delayMs = 800) { this.delay = delayMs; this.lastId = null; this.lastTime = 0; }
  shouldDispatch(id) {
    const now = Date.now();
    if (id !== this.lastId || now - this.lastTime >= this.delay) {
      this.lastId = id; this.lastTime = now; return true;
    }
    return false;
  }
}

if (typeof module !== "undefined") module.exports = { classifyGesture, getGestureMeta, GestureDebouncer };
else window.GestureEngine = { classifyGesture, getGestureMeta, GestureDebouncer };
