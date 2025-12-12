/* ============================================================
   GeoQuiz QR – SCRIPT.JS | Versi Stabil
   ============================================================ */

/* ============================================================
   1) SENARAI QR (guna nama fail tanpa extension)
   ============================================================ */
const QR_PATH = "static/qr_images/";
const validQRImages = ["granite", "gneiss"];

/* ============================================================
   2) KATEGORI
   ============================================================ */
const rockCategory = {
    granite: "Igneus",
    gneiss: "Metamorf"
};

/* ============================================================
   3) GET ELEMENTS
   ============================================================ */
const video = document.getElementById("video");
const statusText = document.getElementById("cameraStatus");
const timerText = document.getElementById("timer");
const scoreBox = document.getElementById("score");
const rockNameBox = document.getElementById("rockName");
const startBtn = document.getElementById("startScanBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const scannerOverlay = document.getElementById("scannerOverlay");

const qrCanvas = document.getElementById("qr-canvas");
const qrCtx = qrCanvas.getContext("2d", { willReadFrequently: true });

/* ============================================================
   4) GLOBAL VARIABLES
   ============================================================ */
let stream = null;
let scanningActive = false;
let scanning = false;
let timer = 30;
let timerInterval = null;

/* Anti Spam QR */
let lastQR = "";
let lastQRTime = 0;
const QR_COOLDOWN = 3000;

/* ============================================================
   Fullscreen
   ============================================================ */
fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});

/* ============================================================
   START / STOP GAME
   ============================================================ */
startBtn.addEventListener("click", async () => {

    /* START GAME */
    if (!scanningActive) {

        const ok = await startCamera();
        if (!ok) return;

        if (typeof jsQR !== "function") {
            statusText.textContent = "Ralat jsQR tidak ditemui.";
            return;
        }

        scanningActive = true;
        scanning = false;

        startBtn.textContent = "■ Tamat Permainan";
        statusText.textContent = "Kamera aktif. Sedia scan.";

        timerText.textContent = "-";
        rockNameBox.textContent = "–";
        scoreBox.textContent = "0";

        scannerOverlay.style.display = "block";

        requestAnimationFrame(scanQR);
        return;
    }

    /* STOP GAME */
    scanningActive = false;
    scanning = false;
    startBtn.textContent = "🎮 Mula Bermain";
    statusText.textContent = "Permainan dihentikan.";

    clearInterval(timerInterval);
    timerText.textContent = "-";
    rockNameBox.textContent = "–";
    scoreBox.textContent = "0";

    scannerOverlay.style.display = "none";
    stopCamera();
});

/* ============================================================
   CAMERA CONTROL
   ============================================================ */
async function startCamera() {

    if (stream) return true; // kalau sudah ON, jangan ON lagi

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        video.srcObject = stream;
        video.setAttribute("playsinline", true);

        await video.play();
        return true;

    } catch (err) {
        statusText.textContent = "Gagal akses kamera.";
        console.error(err);
        return false;
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    video.srcObject = null;
}

/* ============================================================
   SCAN QR LOOP
   ============================================================ */
function scanQR() {

    if (!scanningActive) return;

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(scanQR);
        return;
    }

    qrCanvas.width = video.videoWidth;
    qrCanvas.height = video.videoHeight;

    qrCtx.drawImage(video, 0, 0, qrCanvas.width, qrCanvas.height);

    let imgData = qrCtx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
    let qr = jsQR(imgData.data, qrCanvas.width, qrCanvas.height);

    if (!scanning && qr) {
        const raw = qr.data.trim().toLowerCase();
        const now = Date.now();

        /* ANTI-SPAM */
        if (raw === lastQR && now - lastQRTime < QR_COOLDOWN) {
            requestAnimationFrame(scanQR);
            return;
        }

        lastQR = raw;
        lastQRTime = now;

        if (validQRImages.includes(raw)) {
            scanning = true;
            statusText.innerHTML = `QR dikesan: <b>${raw}</b>`;
            startTimer(raw);
        } else {
            statusText.textContent = "QR tidak sah.";
        }
    }

    requestAnimationFrame(scanQR);
}

/* ============================================================
   TIMER
   ============================================================ */
function startTimer(rockName) {

    timer = 30;
    timerText.textContent = timer;

    rockNameBox.textContent = rockNameMapping(rockName);

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {

        timer--;
        timerText.textContent = timer;

        if (timer <= 0) {
            clearInterval(timerInterval);
            calculateScore(rockName);
        }

    }, 1000);
}

function rockNameMapping(raw) {
    return rockCategory[raw]
        ? `${raw} — ${rockCategory[raw]}`
        : raw;
}

/* ============================================================
   SCORE
   ============================================================ */
function calculateScore(rockName) {

    clearInterval(timerInterval);

    const used = 30 - timer;
    const score = Math.max(1, Math.min(10, 10 - Math.floor(used / 3)));

    scoreBox.textContent = score;

    setTimeout(() => {

        statusText.textContent = "Sedia scan seterusnya.";
        timerText.textContent = "-";
        scoreBox.textContent = "0";
        scanning = false;

        lastQR = "";
        lastQRTime = 0;

        timer = 30;

    }, 3000);
}

/* ============================================================
   HALL OF FAME
   ============================================================ */
function saveHallOfFame() {
    const name = document.getElementById("playerName").value || "Tanpa Nama";
    const score = parseInt(document.getElementById("finalScore").textContent || "0");

    const rec = { name, score, date: new Date().toISOString() };
    const arr = JSON.parse(localStorage.getItem("hof") || "[]");

    arr.push(rec);
    localStorage.setItem("hof", JSON.stringify(arr));

    loadHallOfFame();
}

function loadHallOfFame() {
    const list = document.getElementById("hofList");
    list.innerHTML = "";

    const arr = JSON.parse(localStorage.getItem("hof") || "[]")
        .sort((a, b) => b.score - a.score);

    arr.forEach((r, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<b>${i + 1}.</b> ${r.name} — ${r.score}`;
        list.appendChild(li);
    });
}
