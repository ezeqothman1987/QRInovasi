/* ============================================================
   CONFIG
   ============================================================ */
const QR_PATH = "static/qr_images/";
const SOUND_PATH = "static/sound/";

/* Jika mahu aktifkan bunyi, buang // pada ketiga-tiga ini */
// const sCorrect = new Audio(SOUND_PATH + "correct.mp3");
// const sWrong   = new Audio(SOUND_PATH + "wrong.mp3");
// const sTimeUp  = new Audio(SOUND_PATH + "timeup.mp3");

/* Senarai QR akan dijana auto dengan fetch folder listing */
let validQRImages = [];

/* Game State */
let currentQR = null;
let lastScanned = "";
let timer = 0;
let timerInterval = null;
let score = 0;
let gameActive = false;

/* Arduino */
let arduinoPort = null;
let writer = null;

/* ============================================================
   LOAD QR LIST AUTO (github pages mode)
   ============================================================ */
async function loadQRList() {
    try {
        const res = await fetch(QR_PATH);
        const text = await res.text();

        const matches = [...text.matchAll(/href="([^"]+\.png)"/g)]
            .map(m => m[1].replace(".png", ""));

        validQRImages = matches;
        console.log("Detected QR files:", validQRImages);

    } catch (e) {
        console.warn("Auto-load QR failed — maybe not supported. Using fallback.");
        validQRImages = ["granite", "gneiss"];
    }
}

/* ============================================================
   CAMERA + QR SCAN
   ============================================================ */
const video = document.getElementById("video");
const qrCanvas = document.getElementById("qr-canvas");
const qrCtx = qrCanvas.getContext("2d");
const rockName = document.getElementById("rockName");

async function startCamera() {
    let stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }});
    video.srcObject = stream;
    await video.play();

    document.getElementById("cameraStatus").innerText = "Kamera aktif!";
}

function tick() {
    if (!gameActive) return requestAnimationFrame(tick);

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        qrCanvas.width = video.videoWidth;
        qrCanvas.height = video.videoHeight;
        qrCtx.drawImage(video, 0, 0, qrCanvas.width, qrCanvas.height);

        const imgData = qrCtx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });

        if (code && code.data !== lastScanned) {
            lastScanned = code.data;
            handleQRCode(code.data);
        }
    }
    requestAnimationFrame(tick);
}

/* ============================================================
   HANDLE QR
   ============================================================ */
function handleQRCode(data) {
    rockName.textContent = data;

    /* auto-check fail wujud */
    if (validQRImages.includes(data)) {
        currentQR = data;
        console.log("QR OK:", data);
    } else {
        console.log("QR tidak dikenali:", data);
    }
}

/* ============================================================
   CATEGORY BUTTONS
   ============================================================ */
function chooseCategory(chosen) {
    if (!gameActive || !currentQR) return;

    /* contoh kategori: granite → jawab igneous */
    const correctType = getCategoryFromQR(currentQR);

    if (chosen === correctType) {
        score++;
        animateCorrect();
        // sCorrect?.play();
    } else {
        animateWrong();
        // sWrong?.play();
    }

    document.getElementById("score").innerText = score;

    /* auto reset 1s */
    setTimeout(() => {
        currentQR = null;
        rockName.textContent = "–";
        lastScanned = "";
    }, 800);
}

/* Dummy mapping contoh – EDIT bila ada data sebenar */
function getCategoryFromQR(name) {
    if (name.includes("granite")) return "igneous";
    if (name.includes("gneiss")) return "metamorphic";
    return "igneous"; // fallback
}

/* ============================================================
   ANIMATION (GREEN / RED)
   ============================================================ */
function animateCorrect() {
    const panel = document.querySelector(".button-panel");
    panel.classList.add("flash-green");
    setTimeout(() => panel.classList.remove("flash-green"), 350);
}

function animateWrong() {
    const panel = document.querySelector(".button-panel");
    panel.classList.add("flash-red");
    setTimeout(() => panel.classList.remove("flash-red"), 350);
}

/* ============================================================
   TIMER
   ============================================================ */
function startTimer() {
    timer = 60;
    document.getElementById("timer").innerText = timer;

    timerInterval = setInterval(() => {
        timer--;
        document.getElementById("timer").innerText = timer;

        if (timer <= 0) {
            clearInterval(timerInterval);
            endGame();
            // sTimeUp?.play();
        }
    }, 1000);
}

/* ============================================================
   GAME CONTROL
   ============================================================ */
function startGame() {
    if (gameActive) return; // lock start
    gameActive = true;

    score = 0;
    document.getElementById("score").innerText = "0";

    document.getElementById("startScanBtn").disabled = true;

    startCamera();
    startTimer();
    tick();
}

function endGame() {
    gameActive = false;
    currentQR = null;

    document.getElementById("startScanBtn").disabled = false;

    document.getElementById("finalScore").innerText = score;
    document.getElementById("endModal").style.display = "block";
}

function resetGame() {
    document.getElementById("endModal").style.display = "none";
    startGame();
}

/* ============================================================
   HALL OF FAME
   ============================================================ */
function saveHallOfFame() {
    const name = document.getElementById("playerName").value || "Player";
    const finalScore = score;

    const list = JSON.parse(localStorage.getItem("hof") || "[]");
    list.push({ name, score: finalScore });

    list.sort((a,b)=>b.score - a.score);
    localStorage.setItem("hof", JSON.stringify(list));

    loadHallOfFame();
    resetGame();
}

function loadHallOfFame() {
    const list = JSON.parse(localStorage.getItem("hof") || "[]");
    const hofList = document.getElementById("hofList");
    hofList.innerHTML = "";

    list.forEach(e => {
        let li = document.createElement("li");
        li.textContent = `${e.name} — ${e.score}`;
        hofList.appendChild(li);
    });
}

/* ============================================================
   ARDUINO MODE
   ============================================================ */
document.getElementById("connectArduinoBtn").addEventListener("click", async () => {
    if (!("serial" in navigator)) return alert("Browser tidak sokong Web Serial API.");

    arduinoPort = await navigator.serial.requestPort();
    await arduinoPort.open({ baudRate: 9600 });

    writer = arduinoPort.writable.getWriter();
    alert("Arduino connected!");
});

/* ============================================================
   START BUTTON
   ============================================================ */
document.getElementById("startScanBtn").addEventListener("click", startGame);

/* ============================================================
   INIT
   ============================================================ */
loadQRList();
