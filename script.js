/* ============================================================
   1) QR LIST
   ============================================================ */
const QR_PATH = "/static/qr_images/";

const validQRImages = [
    "qr","batu2","batu3","batu4","batu5",
    "batu6","batu7","batu8","batu9","batu10",
    "batu11","batu12","batu13","batu14","batu15"
];

/* ============================================================
   2) HTML ELEMENTS
   ============================================================ */
const video = document.getElementById("video");
const statusText = document.getElementById("cameraStatus");
const startBtn = document.getElementById("startScanBtn");
const timerText = document.getElementById("timer");
const scoreBox = document.getElementById("score");

/* ============================================================
   3) SOUND EFFECTS (KEKAL, TIDAK DIBUANG)
   ============================================================ */

// const soundCorrect = new Audio("sound/correct.mp3");
// const soundWrong = new Audio("sound/wrong.mp3");
// const soundScan = new Audio("sound/scan.mp3");
// const soundTick = new Audio("sound/tick.mp3");

/* ============================================================
   4) GLOBAL VARS
   ============================================================ */
let stream = null;
let scanningActive = false;
let scanning = false;
let timer = 30;
let timerInterval = null;

let lastQR = "";
let lastQRTime = 0;
const QR_COOLDOWN = 3000;

/* ============================================================
   FULLSCREEN
   ============================================================ */
document.getElementById("fullscreenBtn").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});

/* ============================================================
   START / STOP GAME
   ============================================================ */
startBtn.addEventListener("click", async () => {
    if (!scanningActive) {
        await startCamera();
        scanningActive = true;
        startBtn.textContent = "■ Tamat";
        requestAnimationFrame(scanQR);
    } else {
        stopCamera();
        scanningActive = false;
        scanning = false;
        startBtn.textContent = "🎮 Mula Bermain";
        clearInterval(timerInterval);
        timerText.textContent = "-";
        scoreBox.textContent = "0";
    }
});

/* ============================================================
   CAMERA FUNCTIONS
   ============================================================ */
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        video.srcObject = stream;
        video.play();
    } catch (err) {
        statusText.textContent = "Gagal buka kamera.";
    }
}

function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
}

/* ============================================================
   SCAN QR
   ============================================================ */
function scanQR() {
    if (!scanningActive) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const qr = jsQR(imgData.data, canvas.width, canvas.height);

    if (!scanning && qr) {
        const raw = qr.data.trim().toLowerCase();

        const now = Date.now();
        if (raw === lastQR && now - lastQRTime < QR_COOLDOWN) {
            requestAnimationFrame(scanQR);
            return;
        }

        lastQR = raw;
        lastQRTime = now;

        if (validQRImages.includes(raw)) {
            scanning = true;
            startTimer(raw);

            // soundScan.play();
        }
    }

    requestAnimationFrame(scanQR);
}

/* ============================================================
   TIMER
   ============================================================ */
function startTimer(rock) {
    timer = 30;
    timerText.textContent = timer;

    timerInterval = setInterval(() => {
        timer--;
        timerText.textContent = timer;

        if (timer <= 0) {
            clearInterval(timerInterval);
            calculateScore(rock);
        }
    }, 1000);
}

/* ============================================================
   SCORING
   ============================================================ */
function calculateScore(rock) {

    const used = 30 - timer;
    const score = Math.max(1, Math.min(10, 10 - Math.floor(used / 3)));

    scoreBox.textContent = score;

    // if (score >= 6) soundCorrect.play();
    // else soundWrong.play();

    setTimeout(() => {
        scanning = false;
        scoreBox.textContent = "0";
        timerText.textContent = "-";
        lastQR = "";
    }, 2500);
}

/* ============================================================
   ============================================================
         ARDUINO INTEGRATION — AUTO DETECT + CONNECT
   ============================================================
   ============================================================ */

const arduinoCheckbox = document.getElementById("arduinoMode");
const connectBtn = document.getElementById("connectArduinoBtn");

let serialPort = null;
let serialWriter = null;
let serialReader = null;

// mula-mula disable
arduinoCheckbox.disabled = true;

/* ============================================================
   AUTO DETECT PLUG-IN
   ============================================================ */
navigator.serial.addEventListener("connect", (e) => {
    arduinoCheckbox.disabled = false;
    connectBtn.textContent = "Arduino Available (Click to Connect)";
});

/* ============================================================
   AUTO DETECT CABUT
   ============================================================ */
navigator.serial.addEventListener("disconnect", () => {
    arduinoCheckbox.checked = false;
    arduinoCheckbox.disabled = true;
    connectBtn.textContent = "Connect Arduino";
    serialPort = null;
});

/* ============================================================
   CONNECT MANUALLY
   ============================================================ */
connectBtn.addEventListener("click", async () => {
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 9600 });

        connectBtn.textContent = "Arduino Connected ✓";
        connectBtn.style.background = "#28a745";

        const txtDecoder = new TextDecoderStream();
        serialPort.readable.pipeTo(txtDecoder.writable);
        serialReader = txtDecoder.readable.getReader();

        const txtEncoder = new TextEncoderStream();
        txtEncoder.readable.pipeTo(serialPort.writable);
        serialWriter = txtEncoder.writable.getWriter();

        listenToArduino();

    } catch (err) {
        connectBtn.textContent = "Connect Arduino (Fail)";
    }
});

/* ============================================================
   RECEIVE SERIAL DATA
   ============================================================ */
async function listenToArduino() {
    while (true) {
        try {
            const { value, done } = await serialReader.read();
            if (done) break;
            if (!value) continue;

            console.log("Arduino:", value.trim());

        } catch (err) {
            break;
        }
    }
}

/* ============================================================
   SEND TO ARDUINO
   ============================================================ */
function sendToArduino(msg) {
    if (!arduinoCheckbox.checked || !serialWriter) return;
    serialWriter.write(msg + "\n");
}
