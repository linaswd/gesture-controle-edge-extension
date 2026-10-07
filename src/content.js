// content.js — GestureControl
console.log("[GestureControl] loaded on", location.hostname);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "GESTURE") return;
  runAction(msg);
  sendResponse({ ok: true });
});

function runAction(msg) {
  const action = msg.action;
  switch (action) {
    case "scroll_down":  smoothScroll(400);                              break;
    case "scroll_up":    smoothScroll(-400);                             break;
    case "arrow_right":  sendKey("ArrowRight", 39);                      break;
    case "arrow_left":   sendKey("ArrowLeft",  37);                      break;
    case "space":        sendKey(" ", 32);                               break;
    case "left_click":   clickAtPointer(msg.pointerX, msg.pointerY);     break;
    default: break;
  }
  showToast(action);
}

function smoothScroll(px) {
  window.scrollBy({ top: px, behavior: "smooth" });
}

// ── Universal key sender ───────────────────────────────────────────────────────
function clickAtPointer(normX, normY) {
  // Convert normalized coords (0-1) to actual page pixels
  const x = Math.round((normX ?? 0.5) * window.innerWidth);
  const y = Math.round((normY ?? 0.5) * window.innerHeight);
  const el = document.elementFromPoint(x, y);
  if (!el) return;
  const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  el.dispatchEvent(new MouseEvent("mouseup",   opts));
  el.dispatchEvent(new MouseEvent("click",     opts));
  console.log("[GestureControl] click at", x, y, "→", el.tagName, el.className.slice(0,30));
}

function sendKey(key, keyCode) {
  const host = location.hostname;

  if (host.includes("canva.com")) {
    sendToCanva(key, keyCode);
  } else if (host.includes("office.com") || host.includes("officeapps.live.com") || host.includes("microsoft365.com")) {
    sendToPowerPoint(key, keyCode);
  } else if (host.includes("docs.google.com")) {
    sendToGoogleSlides(key, keyCode);
  } else {
    fireOnAll(key, keyCode);
  }
}

function sendToCanva(key, keyCode) {
  // Find the presentation viewer element and click it to ensure focus
  const presentationEl =
    document.querySelector("[class*='presentation']") ||
    document.querySelector("[class*='slide']") ||
    document.querySelector("main") ||
    document.body;

  presentationEl.click();
  presentationEl.focus();

  // Small delay to let click register before sending key
  setTimeout(() => {
    fireKey(presentationEl, key, keyCode);
    fireKey(document.body, key, keyCode);
    fireKey(document.documentElement, key, keyCode);
  }, 50);
}

function sendToPowerPoint(key, keyCode) {
  // PowerPoint Online uses an iframe — try to reach inside it
  const frames = document.querySelectorAll("iframe");
  let sent = false;
  for (const frame of frames) {
    try {
      const doc = frame.contentDocument;
      if (doc) {
        const el = doc.activeElement ?? doc.body;
        el.click();
        fireKey(el, key, keyCode);
        sent = true;
      }
    } catch(e) {}
  }
  if (!sent) {
    // Fallback: click the main area and fire
    document.body.click();
    fireOnAll(key, keyCode);
  }
}

function sendToGoogleSlides(key, keyCode) {
  const frames = document.querySelectorAll("iframe");
  for (const frame of frames) {
    try {
      const doc = frame.contentDocument;
      if (doc) {
        fireKey(doc.body, key, keyCode);
      }
    } catch(e) {}
  }
  fireOnAll(key, keyCode);
}

function fireOnAll(key, keyCode) {
  // Broadcast to every possible target
  const targets = [
    document.activeElement,
    document.body,
    document.documentElement,
  ].filter(Boolean);
  for (const el of targets) {
    fireKey(el, key, keyCode);
  }
}

function fireKey(el, key, keyCode) {
  if (!el) return;
  const opts = {
    key,
    code: key === " " ? "Space" : key,
    keyCode,
    which: keyCode,
    charCode: key === " " ? 32 : 0,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  try {
    el.dispatchEvent(new KeyboardEvent("keydown",  opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup",    opts));
  } catch(e) {}
}

// ── Toast ──────────────────────────────────────────────────────────────────────
const LABELS = {
  scroll_down: "↓ Scroll Down",
  scroll_up:   "↑ Scroll Up",
  arrow_right: "→ Next Slide",
  arrow_left:  "← Prev Slide",
  space:       "⎵ Space",
  left_click:  "🖱️ Click",
};

let toastEl = null, toastTimer = null;
function showToast(action) {
  const label = LABELS[action] ?? action;
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:2147483647;
      background:rgba(10,10,10,0.88);color:white;
      padding:10px 18px;border-radius:12px;
      font-family:-apple-system,sans-serif;font-size:15px;
      backdrop-filter:blur(8px);transition:opacity 0.3s;
      pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = label;
  toastEl.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = "0"; }, 1800);
}
