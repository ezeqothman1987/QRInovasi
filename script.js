/* ============================================================
   GEO-QUIZ QR – FINAL VERSION (2 BUTTON: BETUL / SALAH)
   ============================================================ */

/* -----------------------------------------
   SETTINGS
-------------------------------------------- */

// Lokasi folder QR (jika perlu guna kemudian)
const QR_PATH = "static/qr_images/";

// Bunyi (fail belum ada, ini hanya placeholder)
const soundCorrect = new Audio("static/sound/correct.mp3");
const soundWrong   = new Audio("static/sound/wrong.mp3");
const soundTimeUp  = new Audio("static/sound/timeup.mp3");


// Untuk elak baca QR berturut2
let lastQR = "";

// Game state
let gameActive = false;
let timerStarted = false;   // ✔ Timer hanya mula selepas QR pertama
let timerInterval;
let timeLeft = 30;          // ✔ Timer = 30s
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
    timerStarted = false;          // ✔ Timer BELUM mula
    startBtn.disabled = true;

    score = 0;
    scoreEl.textContent = score;

    timeLeft = 30;                  // ✔ Timer mula pada 30 tetapi tidak countdown lagi
    timerEl.textContent = timeLeft;

    rockName.textContent = "–";

    scannerOverlay.style.display = "block";
    lastQR = "";

    startCamera();                  // ✔ Hanya aktif kamera dahulu
}


/* ============================================================
   TIMER (bermula selepas QR pertama)
   ============================================================ */

function startTimer() {
    if (timerStarted) return;       // ✔ Elak timer 2 kali

    timerStarted = true;

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
    timerStarted = false;

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

    // Pastikan video sudah ready
    if (video.videoWidth === 0) {
        requestAnimationFrame(scanLoop);
        return;
    }

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

    // ✔ MULA TIMER apabila QR pertama dikesan
    if (!timerStarted) startTimer();

    rockName.textContent = qrText.toUpperCase();

    if (qrText === "betul") {
        handleAnswer(true);
    } 
    else if (qrText === "salah") {
        handleAnswer(false);
    } 
    else {
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
   FEEDBACK (MARKAH MENGIKUT KELAJUAN + ANIMASI)
   ============================================================ */

function handleAnswer(correct) {

    if (correct) {

        /* -----------------------------------------
           MARKAH MENGIKUT KELAJUAN:
           max 10, min 1
           formula = ceil(timeLeft / 3)
        --------------------------------------------*/
        let speedScore = Math.max(1, Math.ceil(timeLeft / 3));

        score += speedScore;
        scoreEl.textContent = score;

        soundCorrect.play().catch(()=>{});
        animateFeedback("correct");

    } else {

        // Penalti salah (tetap -5)
        score -= 5;
        scoreEl.textContent = score;

        soundWrong.play().catch(()=>{});
        animateFeedback("wrong");
    }

    // Reset QR untuk soalan seterusnya
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
   HALL OF FAME
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
