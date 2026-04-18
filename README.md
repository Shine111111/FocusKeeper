# FocusKeeper

FocusKeeper is a client-side web application designed to help you maintain productivity. It uses your webcam and AI-powered facial landmark detection to track your eye gaze. If it detects that you are looking away from the screen (e.g., down at your phone) for a set amount of time, it triggers a highly visible, full-screen warning to break your distraction.

## Features

- **Real-Time Gaze Detection:** Utilizes MediaPipe FaceMesh to accurately track iris positioning and determine if you are looking away or down.
- **Customizable Alerts:** Use the built-in slider to adjust how long you can look away before the warning triggers (from 10 seconds up to 10 minutes).
- **Picture-in-Picture (PiP) Mode:** Keep the timer and status visible on top of all other windows while you work.
- **Popup Mode:** Easily launch the app in a minimal popup window.
- **Privacy First:** 100% browser-based. All machine learning inference happens locally on your machine—no video data is ever sent to a server.
- **Audio & Visual Warnings:** Features a pulsing red overlay, flashing window title, and audio beeps to quickly grab your attention.

## Technical Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Machine Learning:** 
  - TensorFlow.js (`@tensorflow/tfjs`)
  - MediaPipe FaceMesh (`@mediapipe/face_mesh`)
  - TFJS Face Landmarks Detection (`@tensorflow-models/face-landmarks-detection`)
- **Environment:** Browser-based (Chrome, Edge, Firefox). No backend server required.

## How to Run

Because FocusKeeper is completely client-side, running it is incredibly simple:

1. Clone or download this repository to your local machine.
2. Navigate to the `focus-keeper` folder.
3. Open `index.html` in any modern web browser.
4. When prompted, **Grant Camera Permissions**. The app cannot function without webcam access.

*Note: For the Picture-in-Picture functionality, ensure you are using a compatible browser (like Chrome or Edge).*

## Usage

1. **Start Focusing:** Once the page loads and the AI model initializes, the app will start tracking your gaze.
2. **Set the Timer:** Adjust the "Alert after" slider to your desired strictness level (e.g., 1 minute).
3. **Stay on Top:** Click "Launch as Popup Window" or "Always On Top (PiP Mode)" so the application can monitor you while you work in other applications.
4. **Pause Detection:** Need a genuine break? Hit the "Pause" button to temporarily disable gaze tracking without triggering the alarm.
