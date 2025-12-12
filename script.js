/* ============================================================
   KONFIGURASI
============================================================ */
const QR_PATH = "static/qr_images/";
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 30;

// Bunyi
const soundCorrect = new Audio("static/sound/correct.mp3");
const soundWrong   = new Audio("static/sound/wrong.mp3");
const soundTimeup  = new Audio("static/sound/timeup.mp3");

/* ============================================================
   PEMBOLEHUBAH GLOBAL
============================================================ */
let video = null;
let canvas = null;
let ctx = null;
let scanning = false;

let currentPayload = "";
let roundCount = 0;
let score = 0;
let timer = ROUND_TIME;
let timerInterval = null;
let awaitingAnswer = false;

/* ============================================================
   MULA GAME
============================================================ */
function startGame() {
    console.log("Game bermula…");

    roundCount = 0;
    score = 0;
    awaitingAnswer = false;

    document.getElementById("score").textContent = 0;
    document.getElementById("rockName").textContent = "–";
    document.getElementById("timer").textContent = ROUND_TIME;

    startCamera();
}

/* ============================================================
   KAMERA
============================================================ */
function startCamera() {
    video = document.getElementById("video");
    canvas = document.getElementById("qr-canvas");   // <-- betul ikut index.html
    ctx = canvas.getContext("2d");

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }})
    .then(stream => {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();

        scanning = true;
        scanLoop();
    })
    .catch(err => {
        console.error("Camera error: ", err);
        document.getElementById("cameraStatus").textContent = "Gagal buka kamera!";
    });
}

/* ============================================================
   LOOP KAMERA → BACA QR
============================================================ */
function scanLoop() {
    if (!scanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let code = jsQR(imageData.data, canvas.width, canvas.height);

            if (code) {
                handleQR(code.data);
            }
        } catch (err) { }
    }

    requestAnimationFrame(scanLoop);
}

/* ============================================================
   BILA QR DIBACA
============================================================ */
function handleQR(payload) {
    if (awaitingAnswer) return;

    currentPayload = payload.trim().toLowerCase();
    console.log("QR payload:", currentPayload);

    if (currentPayload !== "betul" && currentPayload !== "salah") {
        console.log("QR tidak sah.");
        return;
    }

    // papar nama batuan di UI
    document.getElementById("rockName").textContent = currentPayload.toUpperCase();

    awaitingAnswer = true;
    startTimer();
}

/* ============================================================
   TIMER
============================================================ */
function startTimer() {
    stopTimer();
    timer = ROUND_TIME;
    document.getElementById("timer").textContent = timer;

    timerInterval = setInterval(() => {
        timer--;
        document.getElementById("timer").textContent = timer;

        if (timer <= 0) {
            soundTimeup.play();
            stopTimer();
            endGame();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

/* ============================================================
   BUTANG BETUL / SALAH
============================================================ */
document.getElementById("btnCorrect").addEventListener("click", () => checkAnswer("betul"));
document.getElementById("btnWrong").addEventListener("click", () => checkAnswer("salah"));

function checkAnswer(userChoice) {
    if (!awaitingAnswer) return;

    stopTimer();

    const isCorrect = userChoice === currentPayload;

    if (isCorrect) {
        soundCorrect.play();

        // kira markah ikut masa
        let earned = Math.max(1, Math.min(10, Math.floor(timer / 3)));
        score += earned;
        document.getElementById("score").textContent = score;

        roundCount++;

        if (roundCount >= TOTAL_ROUNDS) {
            endGame();
        } else {
            awaitingAnswer = false; // QR seterusnya boleh dibaca
            document.getElementById("rockName").textContent = "–";
        }

    } else {
        soundWrong.play();
        endGame();
    }
}

/* ============================================================
   TAMAT GAME
============================================================ */
function endGame() {
    scanning = false;
    awaitingAnswer = false;
    stopTimer();

    document.getElementById("finalScore").textContent = score;

    document.getElementById("endModal").style.display = "block";
}

/* ============================================================
   RESET GAME
============================================================ */
function resetGame() {
    document.getElementById("endModal").style.display = "none";
    startGame();
}

/* ============================================================
   HALL OF FAME
============================================================ */
function saveHallOfFame() {
    const name = document.getElementById("playerName").value.trim();
    if (!name) return;

    let hof = JSON.parse(localStorage.getItem("hof") || "[]");

    const now = new Date();
    const timestamp =
        now.toLocaleDateString("ms-MY", { year: "numeric", month: "short", day: "numeric" }) +
        " " +
        now.toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

    hof.push({
        name,
        score,
        time: timestamp,
        ms: now.getTime()
    });

    // Susun ikut markah tinggi → masa cepat
    hof.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.ms - b.ms;
    });

    // Limit 10 rekod
    hof = hof.slice(0, 10);

    localStorage.setItem("hof", JSON.stringify(hof));

    loadHallOfFame();
}

function loadHallOfFame() {
    const list = document.getElementById("hofList");
    if (!list) return; // jika tiada senarai di HTML (elakkan error)

    list.innerHTML = "";

    let hof = JSON.parse(localStorage.getItem("hof") || "[]");

    hof.forEach((entry, index) => {
        const li = document.createElement("li");
        let medal = ["🥇", "🥈", "🥉"][index] || "";

        li.textContent = `${medal} ${entry.name} – ${entry.score} pts (${entry.time})`;
        list.appendChild(li);
    });
}

document.getElementById("saveNameBtn").addEventListener("click", saveHallOfFame);
