/* ============================================================
   SCRIPT.JS — Versi Tersusun + Komentar Lengkap
   ============================================================ */

/* ============================================================
   1) KONFIGURASI GLOBAL
   ============================================================ */
const QR_PATH = "static/qr_images/";
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 30;

// Audio
const soundCorrect = new Audio("static/sound/correct.mp3");
const soundWrong   = new Audio("static/sound/wrong.mp3");
const soundTimeUp  = new Audio("static/sound/timeup.mp3");


/* ============================================================
   2) VARIABEL PERMAINAN
   ============================================================ */
let currentRound = 1;
let score = 0;
let timeLeft = ROUND_TIME;
let scannedQR = null;
let timerInterval = null;
let antiSpam = false;


/* ============================================================
   3) QR SCANNER — Kamera & Pembacaan
   ============================================================ */
let video = document.getElementById("video");
let canvasElement = document.getElementById("qrCanvas");
let canvas = canvasElement.getContext("2d");

function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.play();
            requestAnimationFrame(scanLoop);
        })
        .catch(err => console.error("Camera error:", err));
}

function scanLoop() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.height = video.videoHeight;
        canvasElement.width  = video.videoWidth;
        canvas.drawImage(video, 0, 0);

        let img = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        let code = jsQR(img.data, img.width, img.height);

        if (code && !antiSpam) {
            antiSpam = true;
            handleQR(code.data.trim());
            setTimeout(() => antiSpam = false, 1500);
        }
    }
    requestAnimationFrame(scanLoop);
}


/* ============================================================
   4) HANDLER QR — Logik Selepas QR Dibaca
   ============================================================ */
function handleQR(text) {
    scannedQR = text;
    document.getElementById("lastQR").innerText = text;
}


/* ============================================================
   5) INPUT JAWAPAN — Butang 1/2/3/4
   ============================================================ */
function chooseAnswer(choice) {
    if (!scannedQR) return;

    let correct = validateAnswer(scannedQR, choice);

    if (correct) {
        soundCorrect.play();
        score++;
        updateHallOfFameTemp();
    } else {
        soundWrong.play();
    }

    nextRound();
}

function validateAnswer(qr, choice) {
    // EDIT LOGIK KATEGORI DI SINI
    if (qr.includes("igneus") && choice === 1) return true;
    if (qr.includes("sedimen") && choice === 2) return true;
    if (qr.includes("metamorf") && choice === 3) return true;
    if (qr.includes("mineral") && choice === 4) return true;
    return false;
}


/* ============================================================
   6) ROUND CONTROL — Timer & Kemajuan
   ============================================================ */
function startTimer() {
    timeLeft = ROUND_TIME;
    document.getElementById("timer").innerText = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("timer").innerText = timeLeft;

        if (timeLeft <= 0) {
            soundTimeUp.play();
            clearInterval(timerInterval);
            nextRound();
        }
    }, 1000);
}

function nextRound() {
    clearInterval(timerInterval);
    scannedQR = null;
    document.getElementById("lastQR").innerText = "-";

    currentRound++;
    if (currentRound > TOTAL_ROUNDS) {
        endGame();
    } else {
        startTimer();
    }
}


/* ============================================================
   7) TAMAT PERMAINAN
   ============================================================ */
function endGame() {
    document.getElementById("finalScore").innerText = score;
    document.getElementById("endScreen").style.display = "block";
    saveHallOfFame(score);
}


/* ============================================================
   8) HALL OF FAME — Simpan & Papar Kiri
   ============================================================ */
function saveHallOfFame(score) {
    let name = prompt("Nama anda:") || "Pemain";
    let list = JSON.parse(localStorage.getItem("hof")) || [];

    list.push({ name, score, date: Date.now() });

    // Sort ikut markah → tarikh
    list.sort((a,b) => b.score - a.score || b.date - a.date);

    // Hadkan 10 rekod
    list = list.slice(0, 10);

    localStorage.setItem("hof", JSON.stringify(list));

    renderHallOfFame();
}

function renderHallOfFame() {
    let list = JSON.parse(localStorage.getItem("hof")) || [];
    let box = document.getElementById("hallLeft");

    box.innerHTML = "";

    list.forEach((item, i) => {
        let medal = ["🥇","🥈","🥉"][i] || "#"+(i+1);
        let row = document.createElement("div");
        row.className = "hofRow";
        row.innerHTML = `${medal} ${item.name} — <b>${item.score}</b>`;
        box.appendChild(row);
    });
}

function updateHallOfFameTemp() {
    // Kemas kini serta‑merta tanpa tamat permainan
    renderHallOfFame();
}


/* ============================================================
   9) FULLSCREEN
   ============================================================ */
function toggleFullscreen() {
    let doc = document.documentElement;
    if (!document.fullscreenElement) {
        doc.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}


/* ============================================================
   10) INIT — Mula Kamera + Timer + HOF
   ============================================================ */
window.onload = () => {
    startCamera();
    startTimer();
    renderHallOfFame();
};
