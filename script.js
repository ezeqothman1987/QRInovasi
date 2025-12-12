/* ============================================================
   script.js — FINAL (clean, commented, safe)
   - Matches your index.html ids (qr-canvas, video, startBtn/startScanBtn, btnCorrect, btnWrong, hofList, playerName, saveNameBtn, endModal, hallOfFameScreen)
   - Flow conforms to your spec (camera starts after Start pressed, QR payload is "betul"/"salah",
     player answers via Arduino/keyboard/on-screen buttons, scoring/time logic as agreed)
   - Safe: no duplicate event hooks, safe audio wrapper, graceful fallbacks
   ============================================================ */

/* =========================
   0) CONFIG
   ========================= */
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 15;       // seconds per question active
const NEXT_ROUND_TIME = 15;  // time to display after correct (paused)
const MAX_POINTS = 10;
const MIN_POINTS = 1;
const AUDIO_PATH = "static/sound/"; // ensure files exist: correct.mp3, wrong.mp3, timeup.mp3

/* =========================
   1) AUDIO + safePlay
   ========================= */
const soundCorrect = new Audio(`${AUDIO_PATH}correct.mp3`);
const soundWrong   = new Audio(`${AUDIO_PATH}wrong.mp3`);
const soundTimeup  = new Audio(`${AUDIO_PATH}timeup.mp3`);

// fallback to noop play to avoid console errors if file missing
[soundCorrect, soundWrong, soundTimeup].forEach(a => {
    a.addEventListener("error", ()=> { a.play = ()=>{}; });
});

function safePlay(aud) {
    if (!aud || typeof aud.play !== "function") return;
    try {
        if ('currentTime' in aud) aud.currentTime = 0;
        aud.play().catch(()=>{});
    } catch(e) {}
}

/* =========================
   2) DOM helpers & canvas
   ========================= */
function el(id){ return document.getElementById(id); }
function setText(id, txt){ const n = el(id); if (n) n.textContent = txt; }
function setTextAll(id, txt){ document.querySelectorAll(`#${id}`).forEach(n => n.textContent = txt); }

const video = el("video");
const canvas = el("qr-canvas"); // must match your index.html
let ctx = null;
if (canvas) {
    try {
        ctx = canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
    } catch(e) {
        ctx = canvas.getContext && canvas.getContext("2d");
    }
}

/* =========================
   3) STATE
   ========================= */
let scanning = false;
let awaitingAnswer = false; // true when QR shown and waiting player's input
let lastQR = "";
let roundCount = 0;
let score = 0;
let timeRemaining = 0;
let questionInterval = null;
let pausedUntilNextQR = false; // when true, timer won't decrement
let qrDebounce = false;        // short frame debounce
let isCooldown = false;        // longer cooldown (3s) after scan to prevent reprocessing

/* =========================
   4) UI init & event hooks
   ========================= */
function initUI() {
    const startBtn = el("startBtn") || el("startScanBtn");
    if (startBtn) startBtn.addEventListener("click", startGame);

    const btnC = el("btnCorrect");
    const btnW = el("btnWrong");
    if (btnC) btnC.addEventListener("click", ()=> playerAnswer("betul"));
    if (btnW) btnW.addEventListener("click", ()=> playerAnswer("salah"));

    // keyboard mapping
    window.addEventListener("keydown", (e) => {
        if (!awaitingAnswer) return;
        const k = e.key.toLowerCase();
        if (k === "1" || k === "b") playerAnswer("betul");
        if (k === "2" || k === "s") playerAnswer("salah");
    });

    const saveBtn = el("saveNameBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveHallOfFame);

    const connectBtn = el("connectArduinoBtn");
    if (connectBtn) connectBtn.addEventListener("click", connectArduinoSerial);

    const fsBtn = el("fullscreenBtn");
    if (fsBtn) fsBtn.addEventListener("click", () => {
        const doc = document.documentElement;
        if (!document.fullscreenElement) {
            if (doc.requestFullscreen) doc.requestFullscreen().catch(()=>{});
            else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
            document.body.classList.add("kiosk");
        } else {
            if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
            document.body.classList.remove("kiosk");
        }
    });

    // defaults
    setText("score", "0");
    setText("timer", String(ROUND_TIME));
    setText("rockName", "–");
    setTextAll("finalScore", "0");
}

/* =========================
   5) Start / reset game
   ========================= */
function startGame() {
    roundCount = 0;
    score = 0;
    timeRemaining = ROUND_TIME;
    awaitingAnswer = false;
    pausedUntilNextQR = false;
    qrDebounce = false;
    isCooldown = false;

    setText("score","0");
    setText("timer", String(ROUND_TIME));
    setText("rockName","–");
    setTextAll("finalScore","0");

    // hide modals if any
    const endModal = el("endModal");
    if (endModal) endModal.style.display = "none";
    const hofScreen = el("hallOfFameScreen");
    if (hofScreen) hofScreen.style.display = "none";

    startCamera();
}

function resetGame() {
    const endModal = el("endModal"); if (endModal) endModal.style.display = "none";
    const hofScreen = el("hallOfFameScreen"); if (hofScreen) hofScreen.style.display = "none";

    roundCount = 0;
    score = 0;
    lastQR = "";
    awaitingAnswer = false;
    timeRemaining = ROUND_TIME;
    pausedUntilNextQR = false;
    isCooldown = false;
    qrDebounce = false;

    setText("score","0");
    setText("timer", String(ROUND_TIME));
    setText("rockName","–");
    setTextAll("finalScore","0");

    startCamera();
}

/* =========================
   6) Camera start/stop & scanLoop
   ========================= */
async function startCamera(){
    if (!video || !canvas || !ctx) {
        console.error("Missing camera/canvas/context.");
        if (el("cameraStatus")) el("cameraStatus").textContent = "Elemen kamera tidak lengkap.";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }});
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.muted = true;
        await video.play();

        scanning = true;
        const overlay = el("scannerOverlay");
        if (overlay) overlay.style.display = "block";
        requestAnimationFrame(scanLoop);
    } catch (err) {
        console.error("Camera error:", err);
        if (el("cameraStatus")) el("cameraStatus").textContent = "Gagal buka kamera.";
    }
}

function stopCamera(){
    try {
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
            video.srcObject = null;
        }
    } catch(e) {}
    scanning = false;
    const overlay = el("scannerOverlay");
    if (overlay) overlay.style.display = "none";
}

function scanLoop(){
    if (!scanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = (typeof jsQR !== "undefined") ? jsQR(imageData.data, canvas.width, canvas.height) : null;

            // if jsQR missing, warn (but only once)
            if (!code && typeof jsQR === "undefined") {
                console.warn("jsQR not found - ensure jsQR.js loaded before script.js");
            }

            // Accept scans only if no active question, not debounced, and not in cooldown
            if (code && !awaitingAnswer && !qrDebounce && !isCooldown) {
                // short debounce to avoid duplicate frame reads
                qrDebounce = true;
                setTimeout(()=> qrDebounce = false, 1200);

                // enable cooldown so new scans are ignored for 5s
                isCooldown = true;
                setTimeout(()=> { isCooldown = false; }, 5000);

                processScannedQR(code.data);
            }
        } catch(e) {
            // ignore occasional frame read errors
            // console.warn("frame read error", e);
        }
    }

    requestAnimationFrame(scanLoop);
}

/* =========================
   7) Process scanned QR (payload expected 'betul' / 'salah')
   ========================= */
function processScannedQR(payload){
    if (!payload) return;

    const txt = String(payload).trim().toLowerCase();

    if (txt !== "betul" && txt !== "salah") {
        console.log("Unrecognized QR payload (expect 'betul'/'salah'):", txt);
        return;
    }

    // set current question state
    lastQR = txt;
    awaitingAnswer = true;
    timeRemaining = ROUND_TIME;
    pausedUntilNextQR = false;
    setText("timer", String(timeRemaining));
    startQuestionTimer();

    setText("rockName", "MULA MENJAWAB");
    if (el("cameraStatus")) el("cameraStatus").textContent = "Sila jawab sekarang!";
}

/* =========================
   8) Question timer
   ========================= */
function startQuestionTimer(){
    stopQuestionTimer();
    setText("timer", String(timeRemaining));
    questionInterval = setInterval(()=> {
        if (pausedUntilNextQR) return; // freeze while paused
        timeRemaining--;
        setText("timer", String(timeRemaining));
        if (timeRemaining <= 0) {
            safePlay(soundTimeup);
            stopQuestionTimer();
            endGame();
        }
    }, 1000);
}

function stopQuestionTimer(){
    if (questionInterval) {
        clearInterval(questionInterval);
        questionInterval = null;
    }
}

/* =========================
   9) Player answers
   ========================= */
function playerAnswer(answer){
    if (!awaitingAnswer) return;

    const a = String(answer).trim().toLowerCase();
    if (!lastQR) {
        // defensive
        safePlay(soundWrong);
        endGame();
        return;
    }

    if (a === lastQR) {

        /* ==========================================
           FLASH GREEN (JAWAPAN BETUL)
        ========================================== */
        const panel = document.querySelector(".button-panel");
        if (panel) {
            panel.classList.add("flash-green");
            setTimeout(() => panel.classList.remove("flash-green"), 350);
        }
        /* ========================================== */

        // correct: stop timer immediately
        stopQuestionTimer();
        safePlay(soundCorrect);

        // scoring proportional to timeRemaining
        let raw = Math.ceil((timeRemaining / ROUND_TIME) * MAX_POINTS);
        let earned = Math.max(MIN_POINTS, Math.min(MAX_POINTS, raw));
        score += earned;
        setText("score", String(score));

        roundCount++;
        awaitingAnswer = false;

        // set NEXT_ROUND_TIME but pause decrement until next QR scan
        timeRemaining = NEXT_ROUND_TIME;
        setText("timer", String(timeRemaining));
        pausedUntilNextQR = true;

        setTimeout(()=> {
            setText("rockName", "–");
            lastQR = "";
        }, 500);

        if (roundCount >= TOTAL_ROUNDS) {
            setTimeout(()=> endGame(), 600);
        }

    } else {

        /* ==========================================
           FLASH RED (JAWAPAN SALAH)
        ========================================== */
        const panel = document.querySelector(".button-panel");
        if (panel) {
            panel.classList.add("flash-red");
            setTimeout(() => panel.classList.remove("flash-red"), 350);
        }
        /* ========================================== */

        // wrong -> immediate end
        stopQuestionTimer();
        safePlay(soundWrong);
        awaitingAnswer = false;
        endGame();
    }
}

/* =========================
   10) End game & hall of fame
   ========================= */
function endGame(){
    stopQuestionTimer();
    stopCamera();
    awaitingAnswer = false;
    scanning = false;

    setTextAll("finalScore", String(score));

    const endModal = el("endModal");
    if (endModal) endModal.style.display = "block";

    const hofScreen = el("hallOfFameScreen");
    if (hofScreen) hofScreen.style.display = "block";
}

function saveHallOfFame(){
    let nameInput = document.querySelector("#hallOfFameScreen #playerName") ||
                    document.querySelector("#endModal #playerName") ||
                    el("playerName");

    if (!nameInput) {
        alert("Field nama tidak ditemui.");
        return;
    }
    const name = (nameInput.value || "").trim();
    if (!name) { alert("Sila isi nama."); return; }

    let hof = JSON.parse(localStorage.getItem("hof") || "[]");
    const now = new Date();
    hof.push({
        name,
        score,
        ts: now.getTime(),
        time: now.toLocaleString()
    });

    hof.sort((a,b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.ts - b.ts;
    });

    hof = hof.slice(0,10);
    localStorage.setItem("hof", JSON.stringify(hof));

    loadHallOfFame();

    const hofScreen = el("hallOfFameScreen"); if (hofScreen) hofScreen.style.display = "none";
    const endModal = el("endModal"); if (endModal) endModal.style.display = "none";
}

/* ============================================================
   Hall of Fame — BORDER + ICON
============================================================ */
function loadHallOfFame() {
    const hofList = document.getElementById("hofList");
    if (!hofList) return;
    hofList.innerHTML = "";

    let hof = JSON.parse(localStorage.getItem("hof") || "[]");

    // Susun ikut markah → kemudian ikut timestamp (bukan string time)
    hof.sort((a, b) => {
        if (b.score === a.score) return a.ts - b.ts;
        return b.score - a.score;
    });

    // Hadkan ke top 10
    hof = hof.slice(0, 10);

    hof.forEach((item, index) => {
        let icon = "⭐";
        if (index === 0) icon = "🥇";
        else if (index === 1) icon = "🥈";
        else if (index === 2) icon = "🥉";

        const li = document.createElement("li");
        li.className = "hof-item";

        // Format tarikh
        let dt = new Date(item.ts);
        let formatted =
            dt.toLocaleDateString("ms-MY") +
            " " +
            dt.toLocaleTimeString("ms-MY");

        li.innerHTML = `
            <div class="hof-rank-icon">${icon}</div>
            <div class="hof-details">
                <span class="name">${item.name}</span>
                <span class="score">Markah: ${item.score}</span>
                <span class="time">📅 ${formatted}</span>
            </div>
        `;

        hofList.appendChild(li);
    });
}


/* ============================================================
   11) Web Serial (Arduino / ESP32) – OPTIONAL
   ------------------------------------------------------------
   Fungsi ini menyambungkan browser ke Arduino/ESP32 melalui USB
   menggunakan Web Serial API. Ia akan membaca teks seperti:
     "betul"  → jawapan betul
     "salah"  → jawapan salah
   *Ubah format input Arduino di bahagian IF (t === "...").
============================================================ */

let serialPort = null;      // Port USB selepas disambung
let serialReader = null;    // Reader untuk membaca data masuk


async function connectArduinoSerial() {

    // --------------------------------------------------------
    // 1) Semak sokongan browser
    // --------------------------------------------------------
    if (!("serial" in navigator)) {
        alert("Browser ini tidak menyokong Web Serial API.");
        return;
    }

    try {
        // --------------------------------------------------------
        // 2) Pilih port USB (browser akan buka popup pilihan)
        // --------------------------------------------------------
        serialPort = await navigator.serial.requestPort();

        // --------------------------------------------------------
        // 3) Buka port USB
        //    ⚠️ Tukar baudRate jika Arduino guna nilai lain.
        // --------------------------------------------------------
        await serialPort.open({ baudRate: 115200 });

        // Decoder: terima data ASCII → jadi text biasa
        const decoder = new TextDecoderStream();
        serialPort.readable.pipeTo(decoder.writable);
        serialReader = decoder.readable.getReader();


        // --------------------------------------------------------
        // 4) Loop baca data dari Arduino/ESP32
        // --------------------------------------------------------
        (async () => {
            while (true) {

                const { value, done } = await serialReader.read();
                if (done) break;
                if (!value) continue;

                // Kadang Arduino hantar banyak line dalam satu batch
                value.split(/\r?\n/).forEach(line => {

                    const t = line.trim().toLowerCase();
                    if (!t) return;

                    // ----------------------------------------------------
                    // 5) Tukar format input di sini jika Arduino hantar
                    //    mesej lain seperti "OK" atau "BTN_A".
                    //
                    // Contoh:
                    // if (t === "ok") playerAnswer("betul");
                    // if (t === "no") playerAnswer("salah");
                    // ----------------------------------------------------
                    if (t === "betul" || t === "salah") {
                        playerAnswer(t);
                    }

                });
            }
        })();

    } catch (e) {
        console.error("Serial connection failed:", e);
        alert("Gagal menyambung ke Arduino/ESP32.");
    }
}


/* =========================
   12) INIT
   ========================= */
document.addEventListener("DOMContentLoaded", ()=> {
    initUI();
    loadHallOfFame();

    if (typeof jsQR === "undefined") {
        console.warn("jsQR library not found — QR scanning disabled.");
        if (el("cameraStatus")) el("cameraStatus").textContent = "jsQR tidak ditemui.";
    }
});

/* End of file */
