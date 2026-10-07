// popup.js — opens camera in a tiny PiP-style popup window, not an iframe
// The window stays alive after the popup closes

const GESTURE_META = {
  one_finger:  { emoji: "☝️", label: "1 finger",   action: "↓ Scroll Down" },
  two_fingers: { emoji: "✌️", label: "2 fingers",  action: "↑ Scroll Up" },
  open_hand:   { emoji: "🤚", label: "Open hand",  action: "🔍 Zoom In" },
  fist:        { emoji: "✊", label: "Fist",         action: "🔎 Zoom Out" },
};

const toggle        = document.getElementById("mainToggle");
const toggleLabel   = document.getElementById("toggleLabel");
const placeholder   = document.getElementById("placeholder");
const videoContainer= document.getElementById("videoContainer");
const statusDot     = document.getElementById("statusDot");
const statusText    = document.getElementById("statusText");
const detectedRow   = document.getElementById("gestureDetected");
const detectedEmoji = document.getElementById("detectedEmoji");
const detectedName  = document.getElementById("detectedName");
const detectedAct   = document.getElementById("detectedAction");
const detectedConf  = document.getElementById("detectedConf");

// Restore state
chrome.storage.local.get("gestureControlActive", ({ gestureControlActive }) => {
  if (gestureControlActive) {
    toggle.checked = true;
    toggleLabel.textContent = "On";
    showActiveUI();
    setStatus("Running ✅ — close this popup!", true);
  }
});

toggle.addEventListener("change", () => {
  const active = toggle.checked;
  toggleLabel.textContent = active ? "On" : "Off";
  chrome.storage.local.set({ gestureControlActive: active });

  if (active) {
    // Open camera.html as a small popup window — survives popup close
    // Always close old window and open fresh — guarantees landmarks work
    chrome.storage.local.get("cameraWindowId", ({ cameraWindowId }) => {
      const openFresh = () => {
        chrome.windows.create({
          url: chrome.runtime.getURL("camera.html"),
          type: "popup",
          width: 320,
          height: 240,
          left: screen.width - 340,
          top: screen.height - 280,
        }, (win) => {
          chrome.storage.local.set({ cameraWindowId: win.id });
          showActiveUI();
          setStatus("Camera window opened!", true);
        });
      };

      if (cameraWindowId) {
        chrome.windows.remove(cameraWindowId, () => {
          chrome.storage.local.remove("cameraWindowId");
          openFresh();
        });
      } else {
        openFresh();
      }
    });
  } else {
    // Close the camera window
    chrome.storage.local.get("cameraWindowId", ({ cameraWindowId }) => {
      if (cameraWindowId) {
        chrome.windows.remove(cameraWindowId).catch(() => {});
        chrome.storage.local.remove("cameraWindowId");
      }
    });
    showIdleUI();
  }
});

// Listen for gesture updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CAMERA_READY") setStatus("Detecting ✅ — close this popup!", true);
  if (msg.type === "CAMERA_ERROR") { setStatus("⚠ " + msg.error, false); }
  if (msg.type === "CAMERA_CLOSED") {
    toggle.checked = false;
    toggleLabel.textContent = "Off";
    chrome.storage.local.set({ gestureControlActive: false });
    showIdleUI();
  }
  if (msg.type === "GESTURE_UPDATE" && msg.gestureId) {
    const meta = GESTURE_META[msg.gestureId];
    if (!meta) return;
    detectedRow.style.display = "flex";
    detectedEmoji.textContent = meta.emoji;
    detectedName.textContent  = meta.label;
    detectedAct.textContent   = meta.action;
    detectedConf.textContent  = "✅";
  } else if (msg.type === "GESTURE_UPDATE") {
    detectedRow.style.display = "none";
  }
});

function showActiveUI() {
  placeholder.style.display = "none";
  let card = videoContainer.querySelector(".active-card");
  if (!card) {
    card = document.createElement("div");
    card.className = "active-card";
    card.style.cssText = `
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; height:140px; gap:8px;
      font-family:-apple-system,sans-serif;
    `;
    card.innerHTML = `
      <div style="font-size:40px">✋</div>
      <div style="font-size:13px;font-weight:600;color:#1a1a1a">Camera running in mini window</div>
      <div style="font-size:11px;color:#aaa;text-align:center;max-width:220px;line-height:1.6">
        Close this popup — gestures keep working!<br>
        The small camera window stays in the corner.
      </div>
    `;
    videoContainer.appendChild(card);
  }
  card.style.display = "flex";
}

function showIdleUI() {
  placeholder.style.display = "flex";
  const card = videoContainer.querySelector(".active-card");
  if (card) card.style.display = "none";
  setStatus("Inactive", false);
  detectedRow.style.display = "none";
}

function setStatus(text, active) {
  statusText.textContent = text;
  statusDot.classList.toggle("active", !!active);
}
