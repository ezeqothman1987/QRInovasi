/* ============================================================
   GEO-QUIZ QR – FINAL VERSION (2 BUTTON: BETUL / SALAH)
   ============================================================ */

/* -----------------------------------------
   SETTINGS
-------------------------------------------- */
const QR_PATH = "static/qr_images/";

// Bunyi (belum aktif – akan aktif bila fail ada)
//const soundCorrect = new Audio("static/sound/correct.mp3");
//const soundWrong   = new Audio("static/sound/wrong.mp3");
//const soundTimeUp  = new Audio("static/sound/timeup.mp3");

// Untuk elak baca QR sama 2 kali
let lastQR = "";

// Game state
let gameActive = false;
let timerInterval;
let timeLeft = 20;
let score = 0;

// Kamera elemen
const video = document.getElementById("video");
const canvas = document.getElementById("qr-canvas");
const ctx = canvas.getContext("2d");

// Butang jawapan
const btnCorrect = document.getElementById("btnCorrect");
const btnWrong   = document.getElementById("btnWrong");

// UI
const rockName = document.getElementById("rockName");
const timerEl  = document.getElementById("timer");
const scoreEl  = document.getElementById("score");
const startBtn = document.getElementById("startScanBtn");
const scannerOverlay = document.getElementById("scannerOverlay");


/* ============================================================
   GAME FLOW
   ============================================================ */

startBtn.addEventListener("click", startGame);

function startGame() {
    if (gameActive) return;

    gameActive = true;
    startBtn.disabled = true;

    score = 0;
    scoreEl.textContent = score;

    timeLeft = 20;
    timerEl.textContent = timeLeft;

    rockName.textContent = "–";

    scannerOverlay.style.display = "block";
    lastQR = "";

    startCamera();
    startTimer();
}


/* ============================================================
   TIMER
   ============================================================ */
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            soundTimeUp.play().catch(()=>{});
            endGame();
        }
    }, 1000);
}


/* ============================================================
   END GAME
   ============================================================ */
function endGame() {
    clearInterval(timerInterval);
    gameActive = false;
    startBtn.disabled = false;

    scannerOverlay.style.display = "none";

    // Hentikan kamera
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
    }

    // Papar popup tamat
    document.getElementById("finalScore").textContent = score;
    document.getElementById("endModal").style.display = "block";
}

function resetGame() {
    document.getElementById("endModal").style.display = "none";
    startGame();
}


/* ============================================================
   CAMERA + QR SCANNER
   ============================================================ */

function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            video.srcObject = stream;
            video.play();
            scanLoop();
        })
        .catch(err => {
            console.error("Camera error: ", err);
        });
}

function scanLoop() {
    if (!gameActive) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, canvas.width, canvas.height);

    if (code && code.data) {
        const qr = code.data.trim().toLowerCase();

        if (qr !== lastQR) {   // Anti spam
            lastQR = qr;
            processQR(qr);
        }
    }

    requestAnimationFrame(scanLoop);
}


/* ============================================================
   PROCESS QR (betul/salah)
   ============================================================ */

function processQR(qrText) {

    rockName.textContent = qrText.toUpperCase();

    if (qrText === "betul") {
        handleAnswer(true);
    } else if (qrText === "salah") {
        handleAnswer(false);
    } else {
        console.warn("QR tidak dikenali:", qrText);
    }

    // Reset QR lock selepas 1.2s
    setTimeout(() => { lastQR = ""; }, 1200);
}


/* ============================================================
   USER ANSWER (BUTTON)
   ============================================================ */

btnCorrect.addEventListener("click", () => chooseAnswer(true));
btnWrong.addEventListener("click", () => chooseAnswer(false));

function chooseAnswer(isCorrectButton) {
    if (!gameActive || !lastQR) return;

    const isCorrectQR = (lastQR === "betul");

    const result = (isCorrectButton === isCorrectQR);
    handleAnswer(result);
}


/* ============================================================
   FEEDBACK (POINT + ANIMATION)
   ============================================================ */

function handleAnswer(correct) {

    if (correct) {
        score += 10;
        scoreEl.textContent = score;

        soundCorrect.play().catch(()=>{});
        animateFeedback("correct");

    } else {
        score -= 5;
        scoreEl.textContent = score;

        soundWrong.play().catch(()=>{});
        animateFeedback("wrong");
    }

    // Reset untuk next QR
    rockName.textContent = "–";
    lastQR = "";
}


/* ============================================================
   ANIMASI HIGHLIGHT BUTTON PANEL
   ============================================================ */

function animateFeedback(type) {
    const panel = document.querySelector(".button-panel");

    if (type === "correct") {
        panel.classList.add("flash-green");
        setTimeout(() => panel.classList.remove("flash-green"), 400);
    } else {
        panel.classList.add("flash-red");
        setTimeout(() => panel.classList.remove("flash-red"), 400);
    }
}


/* ============================================================
   HALL OF FAME (tidak diubah)
   ============================================================ */

function saveHallOfFame() {
    const name = document.getElementById("playerName").value.trim();
    if (!name) return;

    let hof = JSON.parse(localStorage.getItem("hof") || "[]");

    hof.push({ name, score });
    hof.sort((a, b) => b.score - a.score);

    localStorage.setItem("hof", JSON.stringify(hof));

    loadHallOfFame();
    resetGame();
}

function loadHallOfFame() {
    const list = document.getElementById("hofList");
    list.innerHTML = "";

    let hof = JSON.parse(localStorage.getItem("hof") || "[]");

    hof.forEach((entry, index) => {
        const li = document.createElement("li");
        li.className = "hof-item";
        if (index === 0) li.classList.add("top-score");
        li.textContent = `${entry.name} – ${entry.score}`;
        list.appendChild(li);
    });
}
