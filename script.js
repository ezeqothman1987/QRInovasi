/* ============================================================
   0) GLOBAL SETTINGS & ELEMENTS
   ============================================================ */
const QR_PATH = "static/qr_images/";
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 30;

let currentRound = 1;
let score = 0;
let timeLeft = ROUND_TIME;
let timerInterval = null;
let scanningEnabled = true;

/* DOM */
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const resultBox = document.getElementById("result");
const scoreBox = document.getElementById("score");
const timerBox = document.getElementById("timer");
const roundBox = document.getElementById("round");
const hofPanel = document.getElementById("hofPanel");

/* ============================================================
   1) THEME TOGGLE (Gelap/Terang) — UI ADDITION
   ============================================================ */
function loadTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
        document.body.classList.add("theme-dark");
    }
}
loadTheme();

function toggleTheme() {
    document.body.classList.toggle("theme-dark");
    const state = document.body.classList.contains("theme-dark")
        ? "dark" : "light";
    localStorage.setItem("theme", state);
}

document.getElementById("themeBtn").addEventListener("click", toggleTheme);

/* ============================================================
   2) FULLSCREEN FIX (Kiosk Mode)
   ============================================================ */
function goFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
}

document.getElementById("fullscreenBtn").addEventListener("click", goFullscreen);

/* ============================================================
   3) ANIMATION TRIGGERS (Scan Flash, Wrong Answer Shake)
   ============================================================ */
function triggerScanFlash() {
    const overlay = document.getElementById("scanFlash");
    overlay.classList.add("active");
    setTimeout(() => overlay.classList.remove("active"), 250);
}

function triggerWrongShake() {
    resultBox.classList.add("shake");
    setTimeout(() => resultBox.classList.remove("shake"), 400);
}

/* ============================================================
   4) CAMERA + QR SCANNER (fungsi asal dikekalkan)
   ============================================================ */
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();

        requestAnimationFrame(scanFrame);
    } catch (err) {
        alert("Tidak dapat akses kamera.");
        console.error(err);
    }
}

function scanFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // QR detection
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code && scanningEnabled) {
            scanningEnabled = false;
            triggerScanFlash();

            processQR(code.data);

            setTimeout(() => {
                scanningEnabled = true;
            }, 1500);
        }
    }

    requestAnimationFrame(scanFrame);
}

/* ============================================================
   5) PROCESS QR (fungsi asal + animasi UI)
   ============================================================ */
function processQR(data) {
    const clean = data.toLowerCase().replace(".png", "").trim();
    
    if (validQRImages.includes(clean)) {
        score += 10;
        scoreBox.textContent = score;
        resultBox.textContent = "Betul!";
        resultBox.classList.add("correct");

        setTimeout(() => {
            resultBox.classList.remove("correct");
        }, 1000);

        nextRound();

    } else {
        resultBox.textContent = "Salah!";
        triggerWrongShake();
    }
}

/* ============================================================
   6) ROUND MANAGEMENT
   ============================================================ */
function nextRound() {
    currentRound++;
    if (currentRound > TOTAL_ROUNDS) {
        endGame();
        return;
    }

    roundBox.textContent = currentRound;
    timeLeft = ROUND_TIME;
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        timerBox.textContent = timeLeft;

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/* ============================================================
   7) END GAME + HALL OF FAME (tak sentuh fungsi asal)
   ============================================================ */
function endGame() {
    clearInterval(timerInterval);
    document.getElementById("endScreen").classList.add("show");
    document.getElementById("finalScore").textContent = score;
}

document.getElementById("saveNameBtn").addEventListener("click", saveHallOfFame);

function saveHallOfFame() {
    const name = document.getElementById("playerName").value || "Tanpa Nama";

    const entry = {
        name: name,
        score: score,
        date: new Date().toLocaleString()
    };

    const list = JSON.parse(localStorage.getItem("hof") || "[]");
    list.push(entry);

    list.sort((a, b) => b.score - a.score); // highest first
    const top10 = list.slice(0, 10);

    localStorage.setItem("hof", JSON.stringify(top10));
    updateHallOfFame();

    document.getElementById("endScreen").classList.remove("show");
}

/* ============================================================
   8) AUTO-REFRESH HALL OF FAME PANEL (Kiri Panel)
   ============================================================ */
function updateHallOfFame() {
    const list = JSON.parse(localStorage.getItem("hof") || "[]");

    hofPanel.innerHTML = `
        <h3>🏆 Hall of Fame</h3>
        <ul>
            ${list.map(e => `
                <li>
                    <strong>${e.name}</strong>
                    <span>${e.score} pts</span>
                    <small>${e.date}</small>
                </li>
            `).join("")}
        </ul>
    `;
}
updateHallOfFame();

/* ============================================================
   9) START GAME
   ============================================================ */
document.getElementById("startBtn").addEventListener("click", () => {
    document.getElementById("startScreen").classList.add("hide");
    startCamera();
    startTimer();
});
