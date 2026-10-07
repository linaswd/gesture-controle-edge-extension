# ✋ GestureControl — Browser Extension

> Control websites with hand gestures. No keyboard. No mouse.

---

## How it works

1. You open the extension popup
2. You toggle it **On** → your webcam activates
3. MediaPipe Hands detects 21 landmarks on your hand in real time
4. A classifier counts your extended fingers → identifies the gesture
5. A message is sent to the content script injected in the page
6. The content script triggers the right action (keyboard event, DOM click, video seek…)

---

## Supported gestures

| Gesture | Fingers | Action |
|---------|---------|--------|
| ☝️ 1 finger | Index only | Next slide / +10s |
| ✌️ 2 fingers | Index + middle | Previous / -10s |
| ✊ Fist | 0 fingers | Pause / Stop |
| 🤚 Open hand | All 5 | Fullscreen |
| 👍 Thumbs up | Thumb up, rest curled | Like (YouTube) |

---

## Supported sites

| Site | Gestures |
|------|----------|
| Google Slides | ☝️ next, ✌️ prev, ✊ escape, 🤚 fullscreen |
| YouTube | ☝️ +10s, ✌️ -10s, ✊ play/pause, 🤚 fullscreen, 👍 like |
| Spotify | ☝️ skip, ✌️ back, ✊ play/pause |
| Google Meet | ✊ mute mic, 🤚 toggle camera |
| Any site | 🤚 fullscreen, ✊ spacebar |

---

## Installation (Chrome / Edge)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder (`gesture-control/`)
5. The ✋ icon appears in your toolbar — click it!

---

## Project structure

```
gesture-control/
├── manifest.json          ← Extension config (Manifest V3)
├── popup.html             ← Extension UI (camera preview, gesture list)
├── popup.js               ← Webcam + MediaPipe detection + UI logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── background.js      ← Service worker (badge, relay)
    └── content.js         ← Injected into pages, handles gesture actions
```

---

## Adding a new site

Open `src/content.js` and add a new entry in the `ADAPTERS` array:

```js
{
  name: "My Site",
  match: () => location.hostname === "mysite.com",
  actions: {
    one_finger:  () => clickSelector(".next-button"),
    fist:        () => clickSelector(".pause-btn"),
    open_hand:   () => toggleFullscreen(),
  }
}
```

---

## Tech stack

- **MediaPipe Hands** — 21-point hand landmark detection, runs in-browser at ~30fps
- **Chrome Extension Manifest V3** — content scripts, service worker, storage API
- **Vanilla JS** — no framework needed, keeps the extension lightweight

---

## Roadmap ideas

- [ ] Custom gesture → action mapping via the popup UI
- [ ] Gesture recording (define your own gesture)
- [ ] Two-hand gesture support
- [ ] Pointer control (move cursor with index finger tip)
- [ ] Gesture history / analytics overlay
