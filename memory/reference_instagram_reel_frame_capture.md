---
name: instagram-reel-frame-capture
description: "Public IG reels can be studied logged-out in the built-in browser, but only via canvas drawImage — screenshots show the <video> as black"
metadata:
  node_type: memory
  type: reference
  originSessionId: 8e1137f0-9b19-4ad0-89b9-c5eeba56cfdd
  modified: 2026-10-21T08:25:45.882Z
---

Logged-out instagram.com/<account>/reel/<id>/ in the built-in browser loads the full video (`document.querySelector('video')`, readyState 4, blob src via MSE), but pane screenshots render it BLACK and the grid thumbnails never paint. Fix: pause + mute, seek (`currentTime`, await `seeked`, +120 ms), `drawImage` onto a fixed-position canvas (not tainted), then screenshot/zoom the canvas — 20 evenly spaced frames in a 5-column sheet works. Caption = `main.innerText` after "Original audio" (no h1). Post links: `a[href*="/reel/"]` on the profile page, img alt gives the date. Used 2026-10-21 to break down @higgsfield.ai reels for [[manus-reel-style-gap]].
