/* ============================================================
   script.js — Final (Detailed & Commented)
   - Matches index.html ids (qr-canvas, video, startBtn/startScanBtn, btnCorrect, btnWrong, hofList, playerName, saveNameBtn, endModal, hallOfFameScreen)
   - Flow:
     * Camera starts only after pressing Start
     * QR contains text "betul" or "salah"
     * Player answers via Arduino (Web Serial) OR keyboard (1/2 or b/s) OR on-screen buttons
     * Correct -> play correct.mp3, award points (1..10 based on remaining time), set timer to NEXT_ROUND_TIME but pause countdown until next QR is scanned
     * Wrong -> play wrong.mp3 -> end game and show modal for name save
     * Timeup -> play timeup.mp3 -> end game
   ============================================================ */

/* =========================
   01) CONFIGURATION
   ========================= */
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 15;       // default per-question time (seconds)
const NEXT_ROUND_TIME = 15;  // time to show between rounds (paused until next QR)
const MAX_POINTS = 10;
const MIN_POINTS = 1;
const AUDIO_PATH = "static/sound/"; // path for audio files

/* =========================
   02) AUDIO (safe load, fallback to noop)
   ========================= */
const soundCorrect = new Audio(`${AUDIO_PATH}correct.mp3`);
const soundWrong   = new Audio(`${AUDIO_PATH}wrong.mp3`);
const soundTimeup  = new Audio(`${AUDIO_PATH}timeup.mp3`);

[soundCorrect, soundWrong, soundTimeup].forEach(a => {
    a.addEventListener("error", ()=> { a.play = ()=>{}; });
});

/* =========================
   03) DOM ELEMENTS & SAFE CONTEXT
   ========================= */
function el(id){ return document.getElementById(id); }
function setText(id, txt){ const n = el(id); if(n) n.textContent = txt; }
function setTextAll(id, txt){ document.querySelectorAll(`#${id}`).forEach(n=>n.textContent = txt); }

const video = el("video");
const canvas = el("qr-canvas"); // confirmed id
let ctx = null;
if (canvas) {
    try {
        ctx = canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
    } catch(e) {
        ctx = canvas.getContext && canvas.getContext("2d");
    }
}

/* =========================
   04) GAME STATE
   ========================= */
let scanning = false;         // camera scanning loop active
let awaitingAnswer = false;   // true after QR detected until answered
let lastQR = "";              // "betul" or "salah"
let roundCount = 0;
let score = 0;
let timeRemaining = 0;
let questionInterval = null;
let pausedUntilNextQR = false; // true after correct answer; timer set but paused
let qrDebounce = false;       // prevent duplicate immediate scans

/* =========================
   05) UI INIT & Event Hooks
   ========================= */
function initUI(){
    // Start buttons — support both ids if present
    const startBtn = el("startBtn") || el("startScanBtn");
    if (startBtn) startBtn.addEventListener("click", startGame);

    // On-screen answer buttons
    const btnC = el("btnCorrect");
    const btnW = el("btnWrong");
    if (btnC) btnC.addEventListener("click", ()=> playerAnswer("betul"));
    if (btnW) btnW.addEventListener("click", ()=> playerAnswer("salah"));

    // Keyboard: '1' or 'b' => betul, '2' or 's' => salah
    window.addEventListener("keydown", (e) => {
        if (!awaitingAnswer) return;
        const k = e.key.toLowerCase();
        if (k === "1" || k === "b") playerAnswer("betul");
        if (k === "2" || k === "s") playerAnswer("salah");
    });

    // Save name button in hall of fame screen (if present)
    const saveBtn = el("saveNameBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveHallOfFame);

    // Connect Arduino button optional (Web Serial)
    const connectBtn = el("connectArduinoBtn");
    if (connectBtn) connectBtn.addEventListener("click", connectArduinoSerial);

    // Fullscreen button
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

    // Set defaults
    setText("score", "0");
    setText("timer", String(ROUND_TIME));
    setText("rockName", "–");
    setTextAll("finalScore", "0");
}

/* =========================
   06) START GAME (triggered by Start button)
   - reset internal counters
   - start camera and scanning
   - roundCount remains 0 until first correct answer
   ========================= */
function startGame(){
    // reset
    roundCount = 0;
    score = 0;
    timeRemaining = ROUND_TIME;
    awaitingAnswer = false;
    pausedUntilNextQR = false;
    qrDebounce = false;

    setText("score","0");
    setText("timer", String(ROUND_TIME));
    setText("rockName","–");
    setTextAll("finalScore","0");

    // hide modals if any
    const endModal = el("endModal");
    if (endModal) endModal.style.display = "none";
    const hofScreen = el("hallOfFameScreen");
    if (hofScreen) hofScreen.style.display = "none";

    // start camera & scanning
    startCamera();
}

/* =========================
   07) CAMERA START/STOP & SCAN LOOP (uses jsQR)
   ========================= */
async function startCamera(){
    if (!video || !canvas || !ctx) {
        console.error("Missing video/canvas/context - cannot start camera.");
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
    } catch (e) {
        console.error("Camera error:", e);
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
        // resize canvas to video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = (typeof jsQR !== "undefined") ? jsQR(imageData.data, canvas.width, canvas.height) : null;

            // Only accept scans if we are not awaiting an answer and not debounced
            if (code && !awaitingAnswer && !qrDebounce) {
                // Debounce immediate re-scans for a short period
                qrDebounce = true;
                setTimeout(()=> qrDebounce = false, 1200);
                processScannedQR(code.data);
            }
        } catch(e){
            // ignore frame read errors occasionally
        }
    }

    requestAnimationFrame(scanLoop);
}

/* =========================
   08) PROCESS SCANNED QR
   - Expecting payload "betul" or "salah"
   - Set awaitingAnswer, start question timer
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
    // reset question timer
    timeRemaining = ROUND_TIME;
    pausedUntilNextQR = false;
    setText("timer", String(timeRemaining));
    startQuestionTimer();

    // show prompt
    setText("rockName", "MULA MENJAWAB");
    if (el("cameraStatus")) el("cameraStatus").textContent = "Sila jawab sekarang!";
}

/* =========================
   09) QUESTION TIMER
   - counts down only if not pausedUntilNextQR
   - if reaches 0 -> timeup -> end game
   ========================= */
function startQuestionTimer(){
    stopQuestionTimer();
    setText("timer", String(timeRemaining));
    questionInterval = setInterval(()=> {
        if (pausedUntilNextQR) return; // don't decrement while paused between rounds
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
   10) PLAYER ANSWER HANDLING
   - Compare answer ("betul"/"salah") with lastQR
   - Correct: award points, set NEXT_ROUND_TIME and pause countdown until next QR
   - Wrong: play wrong -> end game
   ========================= */
function playerAnswer(answer){
    if (!awaitingAnswer) return; // nothing to answer

    const a = String(answer).trim().toLowerCase();
    // Safety: if lastQR empty treat as wrong (shouldn't happen)
    if (!lastQR) {
        safePlay(soundWrong);
        endGame();
        return;
    }

    if (a === lastQR) {
        // Correct
        safePlay(soundCorrect);

        // Score based on timeRemaining: map to 1..MAX_POINTS
        // Use proportion of timeRemaining over ROUND_TIME
        let raw = Math.ceil((timeRemaining / ROUND_TIME) * MAX_POINTS);
        let earned = Math.max(MIN_POINTS, Math.min(MAX_POINTS, raw));
        score += earned;
        setText("score", String(score));

        // progress round
        roundCount++;
        awaitingAnswer = false;
        stopQuestionTimer();

        // set NEXT_ROUND_TIME but pause countdown until next QR scanned
        timeRemaining = NEXT_ROUND_TIME;
        setText("timer", String(timeRemaining));
        pausedUntilNextQR = true;

        // clear prompt after short delay for UX
        setTimeout(()=> {
            setText("rockName", "–");
            lastQR = "";
        }, 500);

        // if finished required rounds -> end after short delay
        if (roundCount >= TOTAL_ROUNDS) {
            setTimeout(()=> endGame(), 600);
        }
    } else {
        // Wrong answer -> immediate end
        safePlay(soundWrong);
        awaitingAnswer = false;
        stopQuestionTimer();
        endGame();
    }
}

/* =========================
   11) END GAME & RESET
   ========================= */
function endGame(){
    stopQuestionTimer();
    stopCamera();
    awaitingAnswer = false;
    scanning = false;

    // display final score(s)
    setTextAll("finalScore", String(score));

    // show end modal
    const endModal = el("endModal");
    if (endModal) endModal.style.display = "block";

    // show hall of fame input screen if exists
    const hofScreen = el("hallOfFameScreen");
    if (hofScreen) hofScreen.style.display = "block";
}

function resetGame(){
    // hide modals/screens
    const endModal = el("endModal"); if (endModal) endModal.style.display = "none";
    const hofScreen = el("hallOfFameScreen"); if (hofScreen) hofScreen.style.display = "none";

    // reset state
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

    // restart camera scanning
    startCamera();
}

/* =========================
   12) HALL OF FAME STORAGE (top 10)
   - saveHallOfFame() takes playerName input and saves {name, score, ts, time}
   - loadHallOfFame() renders into #hofList (if present)
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
    // hide hall of fame input after save
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
   13) ARDUINO / ESP32 via Web Serial (optional)
   - Reads lines from serial; expects lines containing 'betul' or 'salah'
   - User must click Connect Arduino button to request port
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
        const textDecoder = new TextDecoderStream();
        serialPort.readable.pipeTo(textDecoder.writable);
        serialReader = textDecoder.readable.getReader();

        (async ()=> {
            while (true) {
                const { value, done } = await serialReader.read();
                if (done) break;
                if (!value) continue;
                value.split(/\r?\n/).forEach(line => {
                    const t = line.trim().toLowerCase();
                    if (t === "betul" || t === "salah") {
                        // emulate player answering physically
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
   14) INIT (DOMContentLoaded)
   - Wire event handlers, render HOF, but DO NOT auto-start camera
   ========================= */
document.addEventListener("DOMContentLoaded", ()=> {
    initUI();
    loadHallOfFame();

    // warn if jsQR missing
    if (typeof jsQR === "undefined") {
        console.warn("jsQR library not found — QR scanning disabled.");
        if (el("cameraStatus")) el("cameraStatus").textContent = "jsQR tidak ditemui.";
    }

    // Hook Start button(s) defensively
    const startBtn = el("startBtn") || el("startScanBtn");
    if (startBtn) startBtn.addEventListener("click", ()=> {
        // ensure initial reset
        roundCount = 0;
        score = 0;
        setText("score","0");
        startCamera();
    });
});

/* =========================
   15) NOTES FOR FUTURE EDITS
   - To change scoring formula: edit playerAnswer where 'raw' and 'earned' computed.
   - To accept other QR payload formats (filename/category), modify processScannedQR()
   - To change per-round pause behaviour, edit pausedUntilNextQR handling
   - To change keys for keyboard: edit initUI keydown mapping
   ========================= */

/* End of file */
