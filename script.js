/* ============================================================
   script.js — FINAL (clean, commented, safe)
   - Matches your index.html ids (qr-canvas, video, startBtn/startScanBtn, btnCorrect, btnWrong, hofList, playerName, saveNameBtn, endModal, hallOfFameScreen)
   - Flow conforms to your spec (camera starts after Start pressed, QR payload is "betul"/"salah",
     player answers via Arduino/keyboard/on-screen buttons, scoring/time logic as agreed)
   - Safe: no duplicate event hooks, safe audio wrapper, graceful fallbacks
   ============================================================ */

/* =========================
   00) SETTINGS (edit if needed)
   ========================= */
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 15;       // active question countdown (seconds)
const NEXT_ROUND_TIME = 15;  // time shown after correct answer, paused until next QR
const MAX_POINTS = 10;       // max points per question
const MIN_POINTS = 1;        // min points per question
const AUDIO_PATH = "static/sound/";

/* =========================
   01) AUDIO LOADING + SAFE PLAY
   - safePlay() is declared early so callers never run into "not defined"
   ========================= */
const soundCorrect = new Audio(`${AUDIO_PATH}correct.mp3`);
const soundWrong   = new Audio(`${AUDIO_PATH}wrong.mp3`);
const soundTimeup  = new Audio(`${AUDIO_PATH}timeup.mp3`);

// fallback: if any audio file fails to load, ensure its .play is a noop
[soundCorrect, soundWrong, soundTimeup].forEach(a => {
    a.addEventListener("error", ()=> { a.play = ()=>{}; });
});

/**
 * safePlay(audioObj)
 * - Play audio if available without throwing errors.
 * - Resets currentTime to 0 so short sounds replay each time.
 */
function safePlay(audioObj) {
    if (!audioObj || typeof audioObj.play !== "function") return;
    try {
        if ('currentTime' in audioObj) audioObj.currentTime = 0;
        audioObj.play().catch(()=>{});
    } catch (e) { /* ignore */ }
}

/* =========================
   02) DOM HELPERS & CANVAS CONTEXT
   ========================= */
function el(id){ return document.getElementById(id); }
function setText(id, txt){ const n = el(id); if (n) n.textContent = txt; }
function setTextAll(id, txt){ document.querySelectorAll(`#${id}`).forEach(n => n.textContent = txt); }

const video = el("video");
const canvas = el("qr-canvas"); // confirmed id from your HTML
let ctx = null;
if (canvas) {
    try {
        ctx = canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
    } catch(e) {
        ctx = canvas.getContext && canvas.getContext("2d");
    }
}

/* =========================
   03) GAME STATE
   ========================= */
let scanning = false;         // camera loop active
let awaitingAnswer = false;   // true when QR shown and waiting for player's answer
let lastQR = "";              // "betul" / "salah"
let roundCount = 0;
let score = 0;
let timeRemaining = 0;
let questionInterval = null;
let pausedUntilNextQR = false; // after correct answer, countdown paused until next QR
let qrDebounce = false;       // short debounce to avoid duplicate scans
let isCooldown = false;   //cooldown sebelum newQR scan


/* =========================
   04) UI INIT
   - Attach event listeners once here
   ========================= */
function initUI(){
    // Start button(s)
    const startBtn = el("startBtn") || el("startScanBtn");
    if (startBtn) startBtn.addEventListener("click", startGame);

    // On-screen answer buttons
    const btnC = el("btnCorrect");
    const btnW = el("btnWrong");
    if (btnC) btnC.addEventListener("click", ()=> playerAnswer("betul"));
    if (btnW) btnW.addEventListener("click", ()=> playerAnswer("salah"));

    // Keyboard mapping: '1' or 'b' -> betul, '2' or 's' -> salah
    window.addEventListener("keydown", (e) => {
        if (!awaitingAnswer) return;
        const k = e.key.toLowerCase();
        if (k === "1" || k === "b") playerAnswer("betul");
        if (k === "2" || k === "s") playerAnswer("salah");
    });

    // Save name (Hall of Fame)
    const saveBtn = el("saveNameBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveHallOfFame);

    // Connect Arduino/ESP32 (optional)
    const connectBtn = el("connectArduinoBtn");
    if (connectBtn) connectBtn.addEventListener("click", connectArduinoSerial);

    // Fullscreen / kiosk
    const fsBtn = el("fullscreenBtn");
    if (fsBtn) fsBtn.addEventListener("click", () => {
        const docEl = document.documentElement;
        if (!document.fullscreenElement) {
            if (docEl.requestFullscreen) docEl.requestFullscreen().catch(()=>{});
            else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
            document.body.classList.add("kiosk");
        } else {
            if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
            document.body.classList.remove("kiosk");
        }
    });

    // default UI values
    setText("score", "0");
    setText("timer", String(ROUND_TIME));
    setText("rockName", "–");
    setTextAll("finalScore", "0");
}

/* =========================
   05) START GAME (user clicks Start)
   - Reset state and start camera scanning
   ========================= */
function startGame(){
    // reset values
    roundCount = 0;
    score = 0;
    timeRemaining = ROUND_TIME;
    awaitingAnswer = false;
    pausedUntilNextQR = false;
    qrDebounce = false;

    setText("score", "0");
    setText("timer", String(ROUND_TIME));
    setText("rockName", "–");
    setTextAll("finalScore", "0");

    // hide modals if present
    const endModal = el("endModal");
    if (endModal) endModal.style.display = "none";
    const hofScreen = el("hallOfFameScreen");
    if (hofScreen) hofScreen.style.display = "none";

    // start camera and scanning
    startCamera();
}

/* =========================
   06) CAMERA & SCAN LOOP (jsQR)
   ========================= */
async function startCamera(){
    if (!video || !canvas || !ctx) {
        console.error("Missing video/canvas/ctx — cannot start camera.");
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
    } catch(e){}
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

            // Accept scans only if no active question, not debounced, and not in cooldown
            if (code && !awaitingAnswer && !qrDebounce && !isCooldown) {
                // short debounce to avoid duplicate frame reads
                qrDebounce = true;
                setTimeout(()=> qrDebounce = false, 1200);

                // enable cooldown so new scans are ignored for a short period (3s)
                isCooldown = true;
                setTimeout(()=> { isCooldown = false; }, 2000);

                processScannedQR(code.data);
            }
        } catch(e) {
            // occasional frame read errors can be ignored
        }
    }

    requestAnimationFrame(scanLoop);
}

/* =========================
   07) PROCESS SCANNED QR
   - Expect "betul" or "salah"
   - Start per-question timer
   ========================= */
function processScannedQR(payload){
    if (!payload) return;

    const txt = String(payload).trim().toLowerCase();

    if (txt !== "betul" && txt !== "salah") {
        console.log("Unrecognized QR payload (expect 'betul'/'salah'):", txt);
        return;
    }

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
   08) QUESTION TIMER
   - counts down when not paused
   - timeup -> endGame
   ========================= */
function startQuestionTimer(){
    stopQuestionTimer();
    setText("timer", String(timeRemaining));
    questionInterval = setInterval(()=> {
        if (pausedUntilNextQR) return;
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
   09) PLAYER ANSWER (compare with lastQR)
   - corrected: stopQuestionTimer() is called immediately to avoid timer race
   ========================= */
function playerAnswer(answer){
    if (!awaitingAnswer) return;

    const a = String(answer).trim().toLowerCase();
    if (!lastQR) {
        // defensive: if no lastQR treat as wrong
        safePlay(soundWrong);
        endGame();
        return;
    }

    if (a === lastQR) {
        // --- STOP TIMER IMMEDIATELY to avoid race where interval still decrements ---
        stopQuestionTimer();

        // Play correct sound
        safePlay(soundCorrect);

        // compute earned points (proportional to remaining time)
        // use ROUND_TIME as baseline (so answering very quickly gets near MAX_POINTS)
        let raw = Math.ceil((timeRemaining / ROUND_TIME) * MAX_POINTS);
        let earned = Math.max(MIN_POINTS, Math.min(MAX_POINTS, raw));
        score += earned;
        setText("score", String(score));

        // progress round
        roundCount++;

        // mark question as answered so scanner can be re-enabled later
        awaitingAnswer = false;

        // set NEXT_ROUND_TIME but DO NOT start countdown (paused until next QR)
        timeRemaining = NEXT_ROUND_TIME;
        setText("timer", String(timeRemaining));
        pausedUntilNextQR = true;

        // small UX delay then clear prompt and lastQR
        setTimeout(()=> {
            setText("rockName", "–");
            lastQR = "";
        }, 500);

        // If reached total rounds, end game shortly
        if (roundCount >= TOTAL_ROUNDS) {
            setTimeout(()=> endGame(), 600);
        }

    } else {
        // Wrong answer -> immediate end
        stopQuestionTimer(); // ensure timer stopped
        safePlay(soundWrong);
        awaitingAnswer = false;
        endGame();
    }
}

/* =========================
   10) END GAME & RESET
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

function resetGame(){
    const endModal = el("endModal"); if (endModal) endModal.style.display = "none";
    const hofScreen = el("hallOfFameScreen"); if (hofScreen) hofScreen.style.display = "none";

    roundCount = 0;
    score = 0;
    lastQR = "";
    awaitingAnswer = false;
    timeRemaining = ROUND_TIME;
    pausedUntilNextQR = false;

    setText("score","0");
    setText("timer", String(ROUND_TIME));
    setText("rockName","–");
    setTextAll("finalScore","0");

    startCamera();
}

/* =========================
   11) HALL OF FAME (localStorage - top 10)
   ========================= */
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

function loadHallOfFame(){
    const list = el("hofList");
    if (!list) return;
    list.innerHTML = "";
    const hof = JSON.parse(localStorage.getItem("hof") || "[]");
    hof.forEach((entry, idx) => {
        const li = document.createElement("li");
        li.className = "hof-item" + (idx===0 ? " top-score" : "");
        const medal = ["🥇","🥈","🥉"][idx] || "";
        li.textContent = `${medal} ${entry.name} – ${entry.score} pts (${entry.time})`;
        list.appendChild(li);
    });
}

/* =========================
   12) ARDUINO via Web Serial (optional)
   ========================= */
let serialPort = null;
let serialReader = null;
async function connectArduinoSerial(){
    if (!("serial" in navigator)) {
        alert("Web Serial API not supported in this browser.");
        return;
    }
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });
        const decoder = new TextDecoderStream();
        serialPort.readable.pipeTo(decoder.writable);
        serialReader = decoder.readable.getReader();

        (async ()=> {
            while (true) {
                const { value, done } = await serialReader.read();
                if (done) break;
                if (!value) continue;
                value.split(/\r?\n/).forEach(line => {
                    const t = line.trim().toLowerCase();
                    if (t === "betul" || t === "salah") {
                        playerAnswer(t);
                    }
                });
            }
        })();
    } catch (e) {
        console.error("Serial connect failed:", e);
        alert("Gagal sambung ke Arduino/ESP32.");
    }
}

/* =========================
   13) INIT (DOMContentLoaded)
   - Call initUI() and load Hall of Fame
   - DO NOT auto-start camera here (start only via Start button)
   ========================= */
document.addEventListener("DOMContentLoaded", ()=> {
    initUI();
    loadHallOfFame();

    if (typeof jsQR === "undefined") {
        console.warn("jsQR library not found — QR scanning disabled.");
        if (el("cameraStatus")) el("cameraStatus").textContent = "jsQR tidak ditemui.";
    }
});

/* =========================
   14) NOTES FOR FUTURE EDITS
   - Scoring: edit computed 'earned' inside playerAnswer()
   - Payload mapping: edit processScannedQR() if QR content changes (e.g., filenames)
   - To change keys: edit initUI() keyboard mapping
   ========================= */

/* End of file */
