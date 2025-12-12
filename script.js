/* ============================================================
   0) GLOBAL VARIABLES + ANTI-SPAM SETTINGS
   ============================================================ */
let video = null;
let canvas = null;
let ctx = null;

let scanning = false;
let timerInterval = null;

let timeLeft = 30;
let score = 0;

let currentQR = "";
let lastScannedQR = "";
let qrCooldown = false;

const QR_PATH = "static/qr_images/";
let validQRImages = [];

/* ============================================================
   1) LOAD QR LIST BY AUTO-SCANNING FOLDER (GitHub Pages limitation)
   ============================================================ */
async function loadQRList() {
    try {
        const res = await fetch(QR_PATH);
        const html = await res.text();

        const regex = /href="([^"]+\.(png|jpg|jpeg|webp))"/gi;
        let match;

        validQRImages = [];

        while ((match = regex.exec(html))) {
            const fileName = match[1]
                .replace(/\.(png|jpg|jpeg|webp)$/i, "")
                .toLowerCase();

            validQRImages.push(fileName);
        }

        console.log("QR list loaded:", validQRImages);
    } catch (err) {
        console.error("⚠ Gagal load senarai QR:", err);
    }
}

/* ============================================================
   2) START CAMERA ONLY WHEN CLICK START
   ============================================================ */
async function startCamera() {
    video = document.getElementById("video");
    canvas = document.getElementById("qr-canvas");
    ctx = canvas.getContext("2d", { willReadFrequently: true });

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
        });

        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();
            scanning = true;
            scanQR();
        };

        document.getElementById("cameraStatus").innerText = "Kamera aktif.";
    } catch (err) {
        console.error("Camera error:", err);
        document.getElementById("cameraStatus").innerText = "Gagal buka kamera.";
    }
}

/* ============================================================
   3) AUTO SCAN QR WITH ANTI-SPAM
   ============================================================ */
function scanQR() {
    if (!scanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code) {
            const qrText = code.data.trim().toLowerCase();

            // === ANTI-SPAM QR ===
            if (qrCooldown) return;
            if (qrText === lastScannedQR) return;

            lastScannedQR = qrText;
            qrCooldown = true;

            // RELEASE COOLDOWN after 1.5s
            setTimeout(() => { 
                qrCooldown = false; 
            }, 1500);

            handleQR(qrText);
        }
    }

    requestAnimationFrame(scanQR);
}

/* ============================================================
   4) PROCESS SCANNED QR
   ============================================================ */
function handleQR(qrText) {
    console.log("QR scanned:", qrText);

    if (!validQRImages.includes(qrText)) {
        document.getElementById("rockName").innerText = "QR Tidak Dikenali!";
        return;
    }

    document.getElementById("rockName").innerText = qrText;
    currentQR = qrText;
}

/* ============================================================
   5) CATEGORY BUTTONS
   ============================================================ */
function chooseCategory(cat) {
    if (!currentQR) return;

    const typeCorrect = {
        granite: "igneous",
        gneiss: "metamorphic",
        sandstone: "sedimentary",
        basalt: "igneous",
        schist: "metamorphic",
    };

    if (typeCorrect[currentQR] === cat) {
        score += 10;
        timeLeft += 3;
        document.getElementById("score").innerText = score;
    } else {
        timeLeft -= 3;
    }

    // reset for next QR
    currentQR = "";
    document.getElementById("rockName").innerText = "–";
}

/* ============================================================
   6) GAME TIMER
   ============================================================ */
function startTimer() {
    timeLeft = 30;
    document.getElementById("timer").innerText = timeLeft + "s";

    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("timer").innerText = timeLeft + "s";

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/* ============================================================
   7) START GAME
   ============================================================ */
document.getElementById("startScanBtn").addEventListener("click", async () => {

    await loadQRList();
    await startCamera();
    startTimer();

    currentQR = "";
    lastScannedQR = "";
    qrCooldown = false;

    score = 0;
    document.getElementById("score").innerText = "0";

    document.getElementById("rockName").innerText = "–";
});

/* ============================================================
   8) END GAME
   ============================================================ */
function endGame() {
    scanning = false;
    clearInterval(timerInterval);

    document.getElementById("finalScore").innerText = score;
    document.getElementById("endModal").style.display = "block";
}

/* ============================================================
   9) RESET GAME
   ============================================================ */
function resetGame() {
    document.getElementById("endModal").style.display = "none";
}

/* ============================================================
   10) HALL OF FAME SYSTEM
   ============================================================ */
function saveHallOfFame() {
    const nameEl = document.getElementById("playerName");
    if (!nameEl.value.trim()) return;

    const entry = {
        name: nameEl.value,
        score,
        date: new Date().toLocaleString(),
    };

    let hall = JSON.parse(localStorage.getItem("hof") || "[]");
    hall.push(entry);

    hall.sort((a, b) => b.score - a.score);
    hall = hall.slice(0, 20);

    localStorage.setItem("hof", JSON.stringify(hall));

    loadHallOfFame();
}

function loadHallOfFame() {
    let hall = JSON.parse(localStorage.getItem("hof") || "[]");

    const list = document.getElementById("hofList");
    list.innerHTML = "";

    hall.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = `${h.name} – ${h.score}`;
        list.appendChild(li);
    });
}

/* ============================================================
   11) INIT ON LOAD
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    loadHallOfFame();
});
