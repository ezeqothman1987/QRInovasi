/* ============================================================
   KONFIGURASI
============================================================ */
const QR_PATH = "static/qr_images/";
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 30; // 30 saat

// Bunyi (anda akan upload kemudian)
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
let awaitingAnswer = false; // ⭐ Penting – Timer hanya berjalan bila tunggu jawapan

/* ============================================================
   MULA GAME
============================================================ */
function startGame() {
    console.log("Game bermula…");

    roundCount = 0;
    score = 0;
    stopTimer();

    document.getElementById("gameOverScreen").style.display = "none";
    document.getElementById("timerDisplay").textContent = ROUND_TIME;

    startCamera();
}

/* ============================================================
   KAMERA
============================================================ */
function startCamera() {
    video = document.getElementById("video");
    canvas = document.getElementById("qrCanvas");
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
    });
}

/* ============================================================
   LOOP IMEJ KAMERA → CUBA BACA QR
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
        } catch (err) {
            /* Kadang² error bila frame kosong – abaikan sahaja */
        }
    }

    requestAnimationFrame(scanLoop);
}

/* ============================================================
   BILA QR BERJAYA DIBACA
============================================================ */
function handleQR(payload) {
    if (awaitingAnswer) return; // ⭐ Anti-QR spam

    console.log("QR payload:", payload);

    currentPayload = payload.trim().toLowerCase();

    // QR mesti "betul" atau "salah"
    if (currentPayload !== "betul" && currentPayload !== "salah") {
        console.log("QR tidak sah.");
        return;
    }

    awaitingAnswer = true;

    // START TIMER HANYA SELEPAS QR
    startTimer();
}

/* ============================================================
   TIMER PER ROUND (MULA selepas QR)
============================================================ */
function startTimer() {
    stopTimer();
    timer = ROUND_TIME;
    document.getElementById("timerDisplay").textContent = timer;

    timerInterval = setInterval(() => {
        timer--;
        document.getElementById("timerDisplay").textContent = timer;

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

        // MARKAH berdasarkan masa
        let earned = Math.max(1, Math.min(10, Math.floor(timer / 3)));
        score += earned;

        roundCount++;

        if (roundCount >= TOTAL_ROUNDS) {
            endGame();
        } else {
            awaitingAnswer = false; // QR seterusnya boleh scan
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
    document.getElementById("hallOfFameScreen").style.display = "block";
}

/* ============================================================
   HALL OF FAME (versi lengkap)
   ============================================================ */

function saveHallOfFame() {
    const name = document.getElementById("playerName").value.trim();
    if (!name) return;

    let hof = JSON.parse(localStorage.getItem("hof") || "[]");

    // Format tarikh & masa cantik
    const now = new Date();
    const timestamp =
        now.toLocaleDateString("ms-MY", {
            year: "numeric",
            month: "short",
            day: "numeric"
        }) +
        " " +
        now.toLocaleTimeString("ms-MY", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });

    // Rekod baru
    hof.push({
        name,
        score,
        time: timestamp,
        ms: now.getTime() // digunakan untuk sorting jika score sama
    });

    // Susun:
    // 1) Markah paling tinggi
    // 2) Kalau markah sama → masa paling awal (lebih pantas)
    hof.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.ms - b.ms; // siapa jawab cepat → atas
    });

    // Hadkan kepada 10 rekod
    hof = hof.slice(0, 10);

    // Simpan semula
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

        // Ikon untuk Top 3
        let medal = "";
        if (index === 0) medal = "🥇 ";
        if (index === 1) medal = "🥈 ";
        if (index === 2) medal = "🥉 ";

        li.textContent = `${medal}${entry.name} – ${entry.score} pts ( ${entry.time} )`;

        list.appendChild(li);
    });
}


document.getElementById("saveNameBtn").addEventListener("click", saveHallOfFame);
