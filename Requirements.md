Project Requirement Document: FocusKeeper Web App
1. Project Overview
Project Name: FocusKeeper Goal: Create a client-side web application that detects if the user is looking at their phone using the laptop webcam. If a phone is detected continuously for a set threshold (10 minutes), a full-screen red warning is displayed to break the user's distraction.

2. Technical Stack
Frontend: HTML5, CSS3, JavaScript (ES6+).

AI/ML: TensorFlow.js (@tensorflow/tfjs) with the COCO-SSD pre-trained model (@tensorflow-models/coco-ssd).

Environment: Browser-based (must work in Chrome/Edge/Firefox). No backend server required.

3. Functional Requirements
3.1 Webcam Integration
The app must request permission to access the user's webcam immediately upon loading.

The video feed should be displayed centrally on the screen.

Constraint: If permission is denied, show a user-friendly error message.

3.2 Object Detection Logic
Load the COCO-SSD model asynchronously.

Run detection on the video feed frame-by-frame (using requestAnimationFrame).

Target Class: Specifically filter for the class string "cell phone".

Confidence Threshold: Only count detections with a confidence score > 60% (0.6).

3.3 State Management (Timer Logic)
The application acts as a state machine with the following logic:

State: IDLE (No phone detected)

Timer is paused or reset to 0.

Warning overlay is hidden.

State: DISTRACTED (Phone detected)

Start/Resume counting time.

Update the UI timer display in real-time.

State: WARNING (Phone detected > 10 Minutes)

Trigger the Warning UI.

Reset Rule: If the phone leaves the frame for more than 3 seconds (buffer time to prevent flickering), the timer resets to 0.

3.4 Warning System
Threshold: 10 minutes (configurable variable CONST_WARNING_LIMIT).

Action: When the timer exceeds the threshold, overlay a full-screen red warning.

Dismissal: The warning should only disappear if the phone is removed from the camera view.

4. UI/UX Requirements
4.1 Layout
Main View: Clean, minimalist interface.

Video Feed: 640x480 resolution, styled with a border.

Status Bar: Located below the video, displaying:

Current Status (e.g., "Scanning...", "Phone Detected").

Timer (e.g., "02:45").

4.2 Warning Overlay
Background: Bright Red (#ff0000) with high opacity.

Text: Large, white, bold text centering the screen.

Message: "PUT THE PHONE AWAY!"

Animation: Text should pulse or blink to grab attention.

5. Non-Functional Requirements
Performance: Inference loop must not freeze the UI.

Privacy: All processing must happen locally in the browser. No video data should be sent to any server.

6. Project Structure
Suggest the following file structure:

Plaintext
/focus-keeper
  ├── index.html      # Main entry point, loads TF.js from CDN
  ├── style.css       # All styling, including warning overlay and animations
  └── app.js          # Webcam access, model loading, detection loop, and timer logic