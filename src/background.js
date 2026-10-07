// background.js — relays messages, tracks camera window

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ gestureControlActive: false });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (["CAMERA_READY","CAMERA_ERROR","GESTURE_UPDATE"].includes(msg.type)) {
    chrome.runtime.sendMessage(msg).catch(() => {});
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "DISPATCH_GESTURE") {
    chrome.storage.local.get("cameraWindowId", ({ cameraWindowId }) => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        // Target: active http tab NOT in the camera window
        chrome.tabs.query({}, (allTabs) => {
          const target = allTabs
            .filter(t => t.url?.startsWith("http"))
            .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];

          if (!target) return;

          chrome.tabs.sendMessage(target.id, {
            type: "GESTURE",
            gestureId: msg.gestureId,
            action: msg.action,
          }).catch(() => {
            chrome.scripting.executeScript({
              target: { tabId: target.id },
              files: ["src/content.js"]
            }).then(() => {
              chrome.tabs.sendMessage(target.id, {
                type: "GESTURE",
                gestureId: msg.gestureId,
                action: msg.action,
              }).catch(() => {});
            }).catch(() => {});
          });
        });
      });
    });
    sendResponse({ ok: true });
    return;
  }

  sendResponse({ ok: false });
});

// Detect camera window closed
chrome.windows.onRemoved.addListener((windowId) => {
  chrome.storage.local.get("cameraWindowId", ({ cameraWindowId }) => {
    if (windowId === cameraWindowId) {
      chrome.storage.local.remove("cameraWindowId");
      chrome.storage.local.set({ gestureControlActive: false });
      chrome.runtime.sendMessage({ type: "CAMERA_CLOSED" }).catch(() => {});
    }
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.gestureControlActive) {
    const active = changes.gestureControlActive.newValue;
    chrome.action.setBadgeText({ text: active ? "ON" : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#534AB7" });
  }
});
