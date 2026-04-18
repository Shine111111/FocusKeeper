// FocusKeeper - Eye Gaze Detection App
// Detects when user's eyes are looking away from the screen

// ==================== CONFIGURATION ====================
const CONFIG = {
    WARNING_LIMIT: 1 * 60 * 1000,   // 1 minute in milliseconds
    RESET_BUFFER: 3000,              // 3 seconds buffer before reset
    GAZE_DOWN_THRESHOLD: 0.38,       // Iris position ratio - higher = looking more down
    SMOOTHING_FRAMES: 5              // Number of frames to average for smoothing
};

// ==================== STATE ====================
const STATE = {
    IDLE: 'IDLE',
    DISTRACTED: 'DISTRACTED',
    WARNING: 'WARNING'
};

let currentState = STATE.IDLE;
let distractedTime = 0;             // Total time looking away (ms)
let lastDetectionTime = null;       // Timestamp of last detection
let lastLookingAwayTime = null;     // When user was last looking away
let detector = null;
let video = null;
let canvas = null;
let ctx = null;
let isRunning = false;
let gazeHistory = [];               // For smoothing gaze detection

// ==================== DOM ELEMENTS ====================
const elements = {
    webcam: null,
    canvas: null,
    statusText: null,
    timerDisplay: null,
    warningOverlay: null,
    errorMessage: null
};

// ==================== INITIALIZATION ====================
async function init() {
    console.log('🚀 FocusKeeper initializing...');
    
    // Get DOM elements
    elements.webcam = document.getElementById('webcam');
    elements.canvas = document.getElementById('canvas');
    elements.statusText = document.getElementById('status-text');
    elements.timerDisplay = document.getElementById('timer-display');
    elements.warningOverlay = document.getElementById('warning-overlay');
    elements.errorMessage = document.getElementById('error-message');
    
    video = elements.webcam;
    canvas = elements.canvas;
    ctx = canvas.getContext('2d');
    
    // Setup webcam
    const webcamReady = await setupWebcam();
    if (!webcamReady) {
        showError();
        return;
    }
    
    // Load model
    updateStatus('Loading AI model...');
    await loadModel();
    
    // Start detection loop
    updateStatus('👀 Watching...');
    isRunning = true;
    detectLoop();
}

// ==================== WEBCAM SETUP ====================
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480,
                facingMode: 'user'
            },
            audio: false
        });
        
        video.srcObject = stream;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                // Set canvas dimensions to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                console.log('📷 Webcam ready');
                resolve(true);
            };
        });
    } catch (error) {
        console.error('❌ Webcam error:', error);
        return false;
    }
}

// ==================== MODEL LOADING ====================
async function loadModel() {
    try {
        // Use MediaPipe FaceMesh for accurate face landmarks
        detector = await faceLandmarksDetection.createDetector(
            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
            {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
                refineLandmarks: true,
                maxFaces: 1
            }
        );
        console.log('🤖 Face detection model loaded');
    } catch (error) {
        console.error('❌ Model loading error:', error);
        updateStatus('Error loading model');
    }
}

// ==================== DETECTION LOOP ====================
async function detectLoop() {
    if (!isRunning || !detector) return;
    
    // Check if detection is paused (global variable set by popup/main page)
    if (typeof detectionPaused !== 'undefined' && detectionPaused) {
        requestAnimationFrame(detectLoop);
        return;
    }
    
    try {
        // Run face detection
        const faces = await detector.estimateFaces(video);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (faces.length > 0) {
            const face = faces[0];
            const gazeData = calculateEyeGaze(face.keypoints);
            
            // Debug: log gaze values
            console.log('Vertical ratio:', gazeData.verticalRatio.toFixed(3), 
                        'isLookingDown:', gazeData.isLookingDown,
                        'threshold:', CONFIG.GAZE_DOWN_THRESHOLD);
            
            // Draw eye tracking indicators
            drawEyeIndicators(face.keypoints, gazeData);
            
            // Check if looking away from screen
            const isLookingAway = gazeData.isLookingDown || gazeData.isLookingAway;
            
            if (isLookingAway) {
                handleLookingAway(gazeData);
            } else {
                handleLookingAtScreen(gazeData);
            }
        } else {
            // No face detected - could be looking away completely
            handleNoFace();
        }
        
        // Update timer display
        updateTimerDisplay();
        
        // Check for warning threshold
        checkWarningThreshold();
        
    } catch (error) {
        console.error('Detection error:', error);
    }
    
    // Continue loop
    requestAnimationFrame(detectLoop);
}

// ==================== EYE GAZE CALCULATION ====================
function calculateEyeGaze(keypoints) {
    // MediaPipe FaceMesh eye landmarks with iris tracking
    // Left eye indices
    const leftEyeTop = keypoints[159];
    const leftEyeBottom = keypoints[145];
    const leftEyeInner = keypoints[133];
    const leftEyeOuter = keypoints[33];
    const leftIris = keypoints[468];  // Left iris center (with refineLandmarks: true)
    
    // Right eye indices  
    const rightEyeTop = keypoints[386];
    const rightEyeBottom = keypoints[374];
    const rightEyeInner = keypoints[362];
    const rightEyeOuter = keypoints[263];
    const rightIris = keypoints[473];  // Right iris center (with refineLandmarks: true)
    
    // Calculate eye openness (to detect if eyes are open)
    const leftEyeHeight = leftEyeBottom.y - leftEyeTop.y;
    const rightEyeHeight = rightEyeBottom.y - rightEyeTop.y;
    const avgEyeOpenness = (leftEyeHeight + rightEyeHeight) / 2;
    
    // Calculate vertical iris position within eye (0 = top, 1 = bottom)
    let leftIrisVerticalRatio = 0.5;
    let rightIrisVerticalRatio = 0.5;
    
    if (leftIris && leftEyeTop && leftEyeBottom) {
        leftIrisVerticalRatio = (leftIris.y - leftEyeTop.y) / leftEyeHeight;
    }
    
    if (rightIris && rightEyeTop && rightEyeBottom) {
        rightIrisVerticalRatio = (rightIris.y - rightEyeTop.y) / rightEyeHeight;
    }
    
    // Average both eyes
    const avgVerticalRatio = (leftIrisVerticalRatio + rightIrisVerticalRatio) / 2;
    
    // Calculate horizontal iris position (0 = looking left, 1 = looking right)
    const leftEyeWidth = leftEyeOuter.x - leftEyeInner.x;
    const rightEyeWidth = rightEyeInner.x - rightEyeOuter.x;
    
    let leftIrisHorizontalRatio = 0.5;
    let rightIrisHorizontalRatio = 0.5;
    
    if (leftIris) {
        leftIrisHorizontalRatio = (leftIris.x - leftEyeInner.x) / leftEyeWidth;
    }
    if (rightIris) {
        rightIrisHorizontalRatio = (rightIris.x - rightEyeOuter.x) / rightEyeWidth;
    }
    
    const avgHorizontalRatio = (leftIrisHorizontalRatio + rightIrisHorizontalRatio) / 2;
    
    // Smooth the gaze values
    gazeHistory.push({ vertical: avgVerticalRatio, horizontal: avgHorizontalRatio });
    if (gazeHistory.length > CONFIG.SMOOTHING_FRAMES) {
        gazeHistory.shift();
    }
    
    const smoothedVertical = gazeHistory.reduce((a, b) => a + b.vertical, 0) / gazeHistory.length;
    const smoothedHorizontal = gazeHistory.reduce((a, b) => a + b.horizontal, 0) / gazeHistory.length;
    
    // Determine if looking down at phone
    const isLookingDown = smoothedVertical < CONFIG.GAZE_DOWN_THRESHOLD;
    
    // Check if looking too far left/right (away from screen)
    const isLookingAway = smoothedHorizontal < 0.3 || smoothedHorizontal > 0.7;
    
    return {
        verticalRatio: smoothedVertical,
        horizontalRatio: smoothedHorizontal,
        eyeOpenness: avgEyeOpenness,
        isLookingDown: isLookingDown,
        isLookingAway: isLookingAway,
        leftIris: leftIris,
        rightIris: rightIris
    };
}

// ==================== LOOKING AWAY/AT SCREEN HANDLERS ====================
function handleLookingAway(gazeData) {
    const now = Date.now();
    lastLookingAwayTime = now;
    
    if (currentState === STATE.IDLE) {
        // Transition to DISTRACTED
        currentState = STATE.DISTRACTED;
    }
    
    // Initialize lastDetectionTime if needed
    if (!lastDetectionTime) {
        lastDetectionTime = now;
    }
    
    // Accumulate time
    const deltaTime = now - lastDetectionTime;
    distractedTime += deltaTime;
    lastDetectionTime = now;
    
    const vertPercent = Math.round(gazeData.verticalRatio * 100);
    if (gazeData.isLookingDown) {
        updateStatus('Eyes Looking Down (' + vertPercent + '%)', true);
    } else {
        updateStatus('Eyes Looking Away', true);
    }
}

function handleLookingAtScreen(gazeData) {
    const now = Date.now();
    
    if (currentState === STATE.DISTRACTED || currentState === STATE.WARNING) {
        // Check if buffer time has passed
        if (lastLookingAwayTime && (now - lastLookingAwayTime > CONFIG.RESET_BUFFER)) {
            // Reset everything
            resetTimer();
        }
    }
    
    lastDetectionTime = null;
    
    if (currentState === STATE.IDLE) {
        updateStatus('Eyes on Screen', false);
    }
}

function handleNoFace() {
    const now = Date.now();
    
    // Treat "no face" same as looking away - could be distracted
    if (currentState === STATE.IDLE) {
        updateStatus('No face detected...', false);
    }
    
    // If was distracted, start buffer
    if (currentState === STATE.DISTRACTED || currentState === STATE.WARNING) {
        if (lastLookingAwayTime && (now - lastLookingAwayTime > CONFIG.RESET_BUFFER)) {
            resetTimer();
        }
    }
    
    lastDetectionTime = null;
}

// ==================== TIMER FUNCTIONS ====================
function resetTimer() {
    distractedTime = 0;
    lastDetectionTime = null;
    lastLookingAwayTime = null;
    currentState = STATE.IDLE;
    hideWarning();
    console.log('Timer reset');
}

function updateTimerDisplay() {
    const totalSeconds = Math.floor(distractedTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    elements.timerDisplay.textContent = display;
}

// ==================== WARNING SYSTEM ====================
function checkWarningThreshold() {
    if (distractedTime >= CONFIG.WARNING_LIMIT) {
        console.log('Threshold reached! distractedTime:', distractedTime, 'limit:', CONFIG.WARNING_LIMIT);
        if (currentState !== STATE.WARNING) {
            currentState = STATE.WARNING;
            showWarning();
        }
    }
}

function showWarning() {
    elements.warningOverlay.classList.remove('hidden');
    console.log('⚠️ WARNING: Looking down for too long!');
}

function hideWarning() {
    elements.warningOverlay.classList.add('hidden');
}

// ==================== UI HELPERS ====================
function updateStatus(text, isDetected = false) {
    elements.statusText.textContent = text;
    if (isDetected) {
        elements.statusText.classList.add('detected');
    } else {
        elements.statusText.classList.remove('detected');
    }
}

function showError() {
    elements.errorMessage.classList.remove('hidden');
    updateStatus('Camera access denied');
}

function drawEyeIndicators(keypoints, gazeData) {
    const isDistracted = gazeData.isLookingDown || gazeData.isLookingAway;
    const color = isDistracted ? '#ff6b6b' : '#00ff00';
    
    // Left eye landmarks
    const leftEyeOutline = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
    // Right eye landmarks
    const rightEyeOutline = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];
    
    // Draw left eye
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    leftEyeOutline.forEach((idx, i) => {
        const point = keypoints[idx];
        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.stroke();
    
    // Draw right eye
    ctx.beginPath();
    rightEyeOutline.forEach((idx, i) => {
        const point = keypoints[idx];
        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.stroke();
    
    // Draw iris positions
    if (gazeData.leftIris) {
        ctx.beginPath();
        ctx.arc(gazeData.leftIris.x, gazeData.leftIris.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }
    
    if (gazeData.rightIris) {
        ctx.beginPath();
        ctx.arc(gazeData.rightIris.x, gazeData.rightIris.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }
    
    // Draw gaze indicator
    drawGazeIndicator(gazeData);
}

function drawGazeIndicator(gazeData) {
    const indicatorX = 80;
    const indicatorY = 80;
    const boxSize = 80;
    
    const isDistracted = gazeData.isLookingDown || gazeData.isLookingAway;
    
    // Background box (represents eye)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(indicatorX - boxSize/2, indicatorY - boxSize/2, boxSize, boxSize);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(indicatorX - boxSize/2, indicatorY - boxSize/2, boxSize, boxSize);
    
    // Draw "safe zone" (where iris should be when looking at screen)
    const safeZoneSize = boxSize * 0.4;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(
        indicatorX - safeZoneSize/2, 
        indicatorY - safeZoneSize/2 - 5, 
        safeZoneSize, 
        safeZoneSize
    );
    ctx.setLineDash([]);
    
    // Draw iris position
    const irisX = indicatorX + (gazeData.horizontalRatio - 0.5) * boxSize * 0.8;
    const irisY = indicatorY + (gazeData.verticalRatio - 0.5) * boxSize * 0.8;
    
    ctx.beginPath();
    ctx.arc(irisX, irisY, 10, 0, 2 * Math.PI);
    ctx.fillStyle = isDistracted ? '#ff6b6b' : '#00ff00';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('EYE GAZE', indicatorX, indicatorY + boxSize/2 + 15);
}

// ==================== START APP ====================
document.addEventListener('DOMContentLoaded', init);
