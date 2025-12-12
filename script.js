/* ============================================================
   FIXED + CLEAN VERSION (Option C: Overlay only after Start)
   ============================================================ */

/* ============================================================
   1) SENARAI QR SAH (guna nama fail tanpa extension dlm qr_images)
   ============================================================ */
const QR_PATH = "static/qr_images/";

const validQRImages = ["granite", "gneiss"];

/* ============================================================
   2) KATEGORI BATU
   ============================================================ */
const rockCategory = {
    granite: "Igneus",
    gneiss: "Metamorf",
};

/* ============================================================
   3) PULL ELEMEN HTML
   ============================================================ */
const video = document.getElementById("video");
const statusText = document.getElementById("cameraStatus");
const timerText = document.getElementById("timer");
const scoreBox = document.getElementById("score");
const rockNameBox = document.getElementById("rockName");
const startBtn = document.getElementById("startScanBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const scannerOverlay = document.getElementById("scannerOverlay");

/* ============================================================
   4) SETTING GLOBAL
   ============================================================ */
let stream = null;
let scanning = false;
let scanningActive = false;
let timer = 30;
let timerInterval = null;

/* ============================================================
   6) ANTI-SPAM QR
   ============================================================ */
let lastQR = "";
let lastQRTime = 0;
const QR_COOLDOWN = 3000;

/* ============================================================
   8) FULLSCREEN BUTTON
   ============================================================ */
fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});

/* ============================================================
   OVERLAY HELPERS (OPTION C)
   ============================================================ */
function showOverlay() {
    if (scannerOverlay) scannerOverlay.style.display = "block";
}
function hideOverlay() {
    if (scannerOverlay) scannerOverlay.style.display = "none";
}
function updateOverlayState() {
    if (!scannerOverlay) return;
    if (scanningActive && !scanning) showOverlay(); else hideOverlay();
}

/* ============================================================
   9) START / STOP GAME
   ============================================================ */
startBtn.addEventListener("click", async () => {
    if (!scanningActive) {
        const ok = await startCamera();
        if (!ok) return;

        if (typeof jsQR !== "function") {
            statusText.textContent = "jsQR tidak ditemui.";
            stopCamera();
            return;
        }

        scanningActive = true;
        scanning = false;
        startBtn.textContent = "■ Tamat Permainan";
        statusText.textContent = "Kamera diaktifkan. Sedia untuk scan.";

        updateOverlayState();
        requestAnimationFrame(scanQR);

    } else {
        stopCamera();
        scanningActive = false;
        scanning = false;
        startBtn.textContent = "🎮 Mula Bermain";
        statusText.textContent = "Permainan dihentikan.";
        clearInterval(timerInterval);
        timerText.textContent = "-";
        scoreBox.textContent = "0";
        rockNameBox.textContent = "–";
        updateOverlayState();
    }
});

/* ============================================================
   10) START CAMERA
   ============================================================ */
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        await video.play();
        hideOverlay();
        return true;
    } catch (err) {
        statusText.textContent = "Gagal mengakses kamera.";
        return false;
    }
}

/* ============================================================
   11) STOP CAMERA
   ============================================================ */
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    video.srcObject = null;
}

/* ============================================================
   12) SCAN QR LOOP
   ============================================================ */
function scanQR() {
    if (!scanningActive) return;

    updateOverlayState();

    const canvas = document.getElementById("qr-canvas") || document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (canvas.width === 0 || canvas.height === 0) {
        requestAnimationFrame(scanQR);
        return;
    }

    let qr = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);

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
            hideOverlay();
            statusText.innerHTML = `QR dikesan: <b>${raw}</b>`;
            timer += 5; if (timer > 30) timer = 30;
            startTimer(raw);
        } else {
            statusText.textContent = "QR tidak sah.";
        }
    }
    requestAnimationFrame(scanQR);
}

/* ============================================================
   13) TIMER
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
    if (!raw) return "–";
    return rockCategory[raw] ? `${raw} — ${rockCategory[raw]}` : raw;
}

/* ============================================================
   14) KIRA SKOR
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
        timer = 30;
        lastQR = "";
        lastQRTime = 0;
        updateOverlayState();
    }, 3000);
}

/* ============================================================
   17) HALL OF FAME
   ============================================================ */
function saveHallOfFame() {
    const nameEl = document.getElementById("playerName");
    const finalScore = document.getElementById("finalScore");
    const name = nameEl?.value || "Tanpa Nama";
    const score = parseInt(finalScore?.textContent || "0");

    const rec = { name, score, date: new Date().toISOString() };
    const arr = JSON.parse(localStorage.getItem("hof") || "[]");
    arr.push(rec);
    localStorage.setItem("hof", JSON.stringify(arr));
    loadHallOfFame();
}

function loadHallOfFame() {
    const list = document.getElementById("hofList");
    if (!list) return;

    list.innerHTML = "";
    const arr = JSON.parse(localStorage.getItem("hof") || "[]").sort((a, b) => b.score - a.score);

    arr.forEach((r, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<b>${i + 1}.</b> ${r.name} — ${r.score}`;
        li.classList.add("hof-item");
        if (i === 0) li.classList.add("top-score");
        list.appendChild(li);
    });
