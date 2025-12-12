/* ============================================================
   KONFIGURASI
============================================================ */
const QR_PATH = "static/qr_images/";
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 30;

// Bunyi (jika fail tak wujud, ia cuma fail senyap)
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
   UTIL
============================================================*/
function setTextByIdAll(id, text) {
    // Handle duplicate IDs gracefully by setting all matches
    const nodes = document.querySelectorAll(`#${id}`);
    if (nodes.length === 0) return;
    nodes.forEach(n => {
        if (n) n.textContent = text;
    });
}
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
function el(id) { return document.getElementById(id); }

/* ============================================================
   MULA / START BUTTON
============================================================ */
function initUI() {
    // Pastikan semua elemen UI wujud sebelum attach events
    const startBtn = el("startScanBtn");
    if (startBtn) startBtn.addEventListener("click", startGame);

    const btnC = el("btnCorrect");
    const btnW = el("btnWrong");
    if (btnC) btnC.addEventListener("click", () => checkAnswer("betul"));
    if (btnW) btnW.addEventListener("click", () => checkAnswer("salah"));

    const saveBtn = el("saveNameBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveHallOfFame);

    // Reset UI initial
    setText("score", "0");
    setText("rockName", "–");
    setText("timer", ROUND_TIME);
    setTextByIdAll("finalScore", "0");
}

/* ============================================================
   MULA GAME
============================================================ */
function startGame() {
    console.log("Mula permainan");
    roundCount = 0;
    score = 0;
    timer = ROUND_TIME;
    awaitingAnswer = false;
    scanning = false; // akan di-set oleh startCamera

    setText("score", "0");
    setText("rockName", "–");
    setText("timer", ROUND_TIME);
    setTextByIdAll("finalScore", "0");

    // Pastikan modal tamat disembunyikan
    const endModal = el("endModal");
    if (endModal) endModal.style.display = "none";

    startCamera();
}

/* ============================================================
   KAMERA
============================================================ */
function startCamera() {
    video = el("video");
    canvas = el("qr-canvas");
    if (!video || !canvas) {
        console.error("Video atau canvas tidak ditemui.");
        if (el("cameraStatus")) el("cameraStatus").textContent = "Elemen kamera tak lengkap.";
        return;
    }

    ctx = canvas.getContext("2d");

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }})
        .then(stream => {
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.muted = true;
            video.play();

            scanning = true;
            if (el("cameraStatus")) el("cameraStatus").textContent = "Kamera aktif. Sila tunjuk QR.";
            requestAnimationFrame(scanLoop);
        })
        .catch(err => {
            console.error("Camera error:", err);
            if (el("cameraStatus")) el("cameraStatus").textContent = "Gagal buka kamera.";
        });
}

function stopCamera() {
    try {
        if (video && video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(t => t.stop());
            video.srcObject = null;
        }
    } catch (e) { /* ignore */ }
    scanning = false;
}

/* ============================================================
   LOOP IMEJ → BACA QR (menggunakan jsQR)
============================================================ */
function scanLoop() {
    if (!scanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // pastikan canvas saiz ikut video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);

            if (code) {
                handleQR(code.data);
            }
        } catch (err) {
            // kadang-kadang cross-origin / frame kosong boleh throw - abaikan
            // console.warn("Frame read error:", err);
        }
    }

    requestAnimationFrame(scanLoop);
}

/* ============================================================
   HANDLE QR
============================================================ */
function handleQR(payload) {
    if (awaitingAnswer) return; // anti-spam

    if (!payload) return;
    currentPayload = String(payload).trim().toLowerCase();
    console.log("QR payload:", currentPayload);

    // valid payload mesti "betul" atau "salah"
    if (currentPayload !== "betul" && currentPayload !== "salah") {
        console.log("QR tidak sah:", currentPayload);
        return;
    }

    // PAPAR TEKS "Sedia Jawab" (menggantikan nama batuan)
    setText("rockName", "Sedia Jawab");

    awaitingAnswer = true;
    startTimer();
}

/* ============================================================
   TIMER
============================================================ */
function startTimer() {
    stopTimer();
    timer = ROUND_TIME;
    setText("timer", timer);

    timerInterval = setInterval(() => {
        timer--;
        setText("timer", timer);

        if (timer <= 0) {
            // masa tamat untuk round → tamat permainan
            try { soundTimeup.play(); } catch (e) {}
            stopTimer();
            endGame();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/* ============================================================
   BUTANG BETUL / SALAH
============================================================ */
function checkAnswer(userChoice) {
    if (!awaitingAnswer) return;

    stopTimer();
    awaitingAnswer = false;

    const isCorrect = userChoice === currentPayload;

    if (isCorrect) {
        try { soundCorrect.play(); } catch (e) {}
        // MARKAH berdasarkan masa (contoh formula)
        const earned = Math.max(1, Math.min(10, Math.floor(timer / 3)));
        score += earned;
        setText("score", String(score));

        roundCount++;
        // reset paparan nama kembali
        setText("rockName", "–");

        if (roundCount >= TOTAL_ROUNDS) {
            endGame();
        } else {
            // sedia untuk QR seterusnya
            awaitingAnswer = false;
            currentPayload = "";
        }

    } else {
        try { soundWrong.play(); } catch (e) {}
        endGame();
    }
}

/* ============================================================
   TAMAT GAME
============================================================ */
function endGame() {
    // hentikan kamera & timer
    stopTimer();
    stopCamera();
    awaitingAnswer = false;
    scanning = false;

    // set final score pada semua elemen berganda
    setTextByIdAll("finalScore", String(score));

    // paparkan modal tamat (modal pertama dalam DOM ialah endModal)
    const endModal = el("endModal");
    if (endModal) endModal.style.display = "block";

    // juga buka Hall of Fame screen jika perlu
    const hof = el("hallOfFameScreen");
    if (hof) hof.style.display = "block";
}

/* ============================================================
   RESET GAME
============================================================ */
function resetGame() {
    // sembunyikan modal/hof dan mula semula
    const endModal = el("endModal");
    if (endModal) endModal.style.display = "none";

    const hof = el("hallOfFameScreen");
    if (hof) hof.style.display = "none";

    startGame();
}

/* ============================================================
   HALL OF FAME (gunakan playerName dalam hallOfFameScreen jika ada)
============================================================ */
function saveHallOfFame() {
    // cari field playerName INSIDE hallOfFameScreen terlebih dahulu
    let nameInput = document.querySelector("#hallOfFameScreen #playerName") ||
                    document.querySelector("#endModal #playerName") ||
                    document.getElementById("playerName");

    if (!nameInput) {
        alert("Field nama tidak ditemui.");
        return;
    }

    const name = nameInput.value.trim();
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

    hof.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.ms - b.ms;
    });

    hof = hof.slice(0, 10);
    localStorage.setItem("hof", JSON.stringify(hof));

    loadHallOfFame();
}

/* Jika tiada elemen #hofList di HTML, fungsi ini akan selamat terus return */
function loadHallOfFame() {
    const list = el("hofList");
    if (!list) return;

    list.innerHTML = "";
    const hof = JSON.parse(localStorage.getItem("hof") || "[]");
    hof.forEach((entry, idx) => {
        const li = document.createElement("li");
        const medal = ["🥇", "🥈", "🥉"][idx] || "";
        li.textContent = `${medal} ${entry.name} – ${entry.score} pts (${entry.time})`;
        list.appendChild(li);
    });
}

/* ============================================================
   INISIALISASI
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    initUI();
    // load existing hof (jika ada)
    if (typeof loadHallOfFame === "function") loadHallOfFame();
});
