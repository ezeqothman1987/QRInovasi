/* ============================================================
   SCRIPT.JS — CLEAN & ORGANIZED
   ------------------------------------------------------------
   Struktur:
   0) Config
   1) Audio
   2) DOM Helpers
   3) State
   4) UI Init
   5) Start/Reset Game
   6) Camera & QR Loop
   7) Process QR
   8) Timer Logic
   9) Player Answer
   10) End Game + Hall of Fame
   11) Web Serial (Arduino/ESP32) — OPTIONAL
   12) INIT
============================================================ */

/* ============================================================
   0) CONFIG
============================================================ */
const TOTAL_ROUNDS = 5;
const ROUND_TIME = 15;
const NEXT_ROUND_TIME = 15;
const MAX_POINTS = 10;
const MIN_POINTS = 1;
const AUDIO_PATH = "static/sound/";

/* ============================================================
   1) AUDIO + safePlay
============================================================ */
const soundCorrect = new Audio(`${AUDIO_PATH}correct.mp3`);
const soundWrong   = new Audio(`${AUDIO_PATH}wrong.mp3`);
const soundTimeup  = new Audio(`${AUDIO_PATH}timeup.mp3`);

[soundCorrect, soundWrong, soundTimeup].forEach(a => {
    a.addEventListener("error", ()=> { a.play = ()=>{}; });
});

function safePlay(aud) {
    if (!aud || typeof aud.play !== "function") return;
    try { aud.currentTime = 0; aud.play().catch(()=>{}); } catch(e){}
}

/* ============================================================
   2) DOM HELPERS & CANVAS
============================================================ */
function el(id){ return document.getElementById(id); }
function setText(id, txt){ const n = el(id); if (n) n.textContent = txt; }
function setTextAll(id, txt){ document.querySelectorAll(`#${id}`).forEach(n => n.textContent = txt); }

const video  = el("video");
const canvas = el("qr-canvas");
let ctx = null;

if (canvas) {
    try { ctx = canvas.getContext("2d", { willReadFrequently: true }); }
    catch{ ctx = canvas.getContext("2d"); }
}

/* ============================================================
   3) GAME STATE
============================================================ */
let scanning = false;
let awaitingAnswer = false;
let lastQR = "";
let roundCount = 0;
let score = 0;
let timeRemaining = 0;
let questionInterval = null;
let pausedUntilNextQR = false;
let qrDebounce = false;
let isCooldown = false;

/* ============================================================
   4) UI INITIALIZATION
============================================================ */
function initUI() {

    // start button
    const startBtn = el("startBtn") || el("startScanBtn");
    if (startBtn) startBtn.addEventListener("click", startGame);

    // answer buttons
    const btnC = el("btnCorrect");
    const btnW = el("btnWrong");
    if (btnC) btnC.addEventListener("click", ()=> playerAnswer("betul"));
    if (btnW) btnW.addEventListener("click", ()=> playerAnswer("salah"));

    // keyboard shortcuts
    window.addEventListener("keydown", (e)=>{
        if (!awaitingAnswer) return;
        const k = e.key.toLowerCase();
        if (k==="1"||k==="b") playerAnswer("betul");
        if (k==="2"||k==="s") playerAnswer("salah");
    });

    // save hall of fame
    const saveBtn = el("saveNameBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveHallOfFame);

    // USB serial connect
    const connectBtn = el("connectArduinoBtn");
    if (connectBtn) connectBtn.addEventListener("click", connectArduinoSerial);

    // fullscreen
    const fsBtn = el("fullscreenBtn");
    if (fsBtn) fsBtn.addEventListener("click", ()=>{
        const doc = document.documentElement;
        if (!document.fullscreenElement) {
            doc.requestFullscreen?.(); 
            document.body.classList.add("kiosk");
        } else {
            document.exitFullscreen?.();
            document.body.classList.remove("kiosk");
        }
    });

    // defaults
    setText("score", "0");
    setText("timer", ROUND_TIME);
    setText("rockName", "–");
    setTextAll("finalScore", "0");
}

/* ============================================================
   5) START / RESET GAME
============================================================ */
function startGame() {
    roundCount = 0;
    score = 0;
    lastQR = "";
    awaitingAnswer = false;
    pausedUntilNextQR = false;
    qrDebounce = false;
    isCooldown = false;

    setText("score","0");
    setText("timer", ROUND_TIME);
    setText("rockName","–");

    // hide any modal
    const endModal = el("endModal"); if (endModal) endModal.style.display = "none";
    const hofScreen = el("hallOfFameScreen"); if (hofScreen) hofScreen.style.display = "none";

    startCamera();
}

function resetGame() {
    startGame();
}

/* ============================================================
   6) CAMERA + QR LOOP
============================================================ */
async function startCamera(){
    if (!video || !canvas || !ctx) {
        console.error("Camera elements missing.");
        if (el("cameraStatus")) el("cameraStatus").textContent = "Elemen kamera tidak lengkap.";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" }});
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
        video?.srcObject?.getTracks()?.forEach(t => t.stop());
        video.srcObject = null;
    } catch{}
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
            ctx.drawImage(video,0,0,canvas.width,canvas.height);

            const img = ctx.getImageData(0,0,canvas.width,canvas.height);
            const code = (typeof jsQR !== "undefined") ? jsQR(img.data, canvas.width, canvas.height) : null;

            if (!code && typeof jsQR === "undefined") {
                console.warn("jsQR not loaded.");
            }

            if (code && !awaitingAnswer && !qrDebounce && !isCooldown) {
                qrDebounce = true;
                setTimeout(()=> qrDebounce=false,1200);

                isCooldown = true;
                setTimeout(()=> isCooldown=false,3000);

                processScannedQR(code.data);
            }
        } catch(e){}
    }

    requestAnimationFrame(scanLoop);
}

/* ============================================================
   7) PROCESS SCANNED QR
============================================================ */
function processScannedQR(payload){
    if (!payload) return;

    const txt = String(payload).trim().toLowerCase();
    if (txt !== "betul" && txt !== "salah") return;

    lastQR = txt;
    awaitingAnswer = true;
    pausedUntilNextQR = false;
    timeRemaining = ROUND_TIME;

    setText("timer", timeRemaining);
    setText("rockName", "MULA MENJAWAB");

    if (el("cameraStatus")) el("cameraStatus").textContent = "Sila jawab sekarang!";

    startQuestionTimer();
}

/* ============================================================
   8) TIMER LOGIC
============================================================ */
function startQuestionTimer(){
    stopQuestionTimer();
    setText("timer", timeRemaining);

    questionInterval = setInterval(()=>{
        if (pausedUntilNextQR) return;

        timeRemaining--;
        setText("timer", timeRemaining);

        if (timeRemaining <= 0) {
            safePlay(soundTimeup);
            stopQuestionTimer();
            endGame();
        }
    },1000);
}

function stopQuestionTimer(){
    clearInterval(questionInterval);
    questionInterval = null;
}

/* ============================================================
   9) PLAYER ANSWER
============================================================ */
function playerAnswer(answer){
    if (!awaitingAnswer) return;

    const a = String(answer).trim().toLowerCase();
    if (!lastQR) {
        safePlay(soundWrong);
        endGame();
        return;
    }

    const panel = document.querySelector(".button-panel");

    if (a === lastQR) {
        if (panel){ panel.classList.add("flash-green"); setTimeout(()=>panel.classList.remove("flash-green"),350); }

        stopQuestionTimer();
        safePlay(soundCorrect);

        let raw = Math.ceil((timeRemaining / ROUND_TIME) * MAX_POINTS);
        let earned = Math.max(MIN_POINTS, Math.min(MAX_POINTS, raw));

        score += earned;
        setText("score", score);

        roundCount++;
        awaitingAnswer = false;

        timeRemaining = NEXT_ROUND_TIME;
        setText("timer", timeRemaining);
        pausedUntilNextQR = true;

        setTimeout(()=>{ setText("rockName","–"); lastQR=""; },500);

        if (roundCount >= TOTAL_ROUNDS){
            setTimeout(()=> endGame(),600);
        }

    } else {
        if (panel){ panel.classList.add("flash-red"); setTimeout(()=>panel.classList.remove("flash-red"),350); }

        stopQuestionTimer();
        safePlay(soundWrong);
        awaitingAnswer = false;
        endGame();
    }
}

/* ============================================================
   10) END GAME + HALL OF FAME
============================================================ */
function endGame(){
    stopQuestionTimer();
    stopCamera();
    awaitingAnswer = false;
    scanning = false;

    setTextAll("finalScore", score);

    const endModal = el("endModal"); if (endModal) endModal.style.display = "block";
    const hofScreen = el("hallOfFameScreen"); if (hofScreen) hofScreen.style.display = "block";
}

function saveHallOfFame(){
    const nameInput =
        document.querySelector("#hallOfFameScreen #playerName") ||
        document.querySelector("#endModal #playerName") ||
        el("playerName");

    if (!nameInput) return alert("Field nama tidak ditemui.");
    const name = (nameInput.value||"").trim();
    if (!name) return alert("Sila isi nama.");

    let hof = JSON.parse(localStorage.getItem("hof")||"[]");
    const now = new Date();

    hof.push({ name, score, ts:now.getTime(), time:now.toLocaleString() });

    hof.sort((a,b)=> b.score - a.score || a.ts - b.ts);
    hof = hof.slice(0,10);

    localStorage.setItem("hof",JSON.stringify(hof));
    loadHallOfFame();

    el("hallOfFameScreen")?.style = "display:none";
    el("endModal")?.style = "display:none";
}

function loadHallOfFame(){
    const list = el("hofList");
    if (!list) return;

    list.innerHTML = "";
    const hof = JSON.parse(localStorage.getItem("hof")||"[]");

    hof.forEach((e,idx)=>{
        const li = document.createElement("li");
        li.className = "hof-item" + (idx===0?" top-score":"");
        const medal = ["🥇","🥈","🥉"][idx] || "";
        li.textContent = `${medal} ${e.name} – ${e.score} pts (${e.time})`;
        list.appendChild(li);
    });
}

/* ============================================================
   11) WEB SERIAL (Arduino / ESP32)
============================================================ */
let serialPort = null;
let serialReader = null;

async function connectArduinoSerial(){

    if (!("serial" in navigator)){
        alert("Browser tidak menyokong Web Serial API.");
        return;
    }

    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate:115200 });

        const decoder = new TextDecoderStream();
        serialPort.readable.pipeTo(decoder.writable);
        serialReader = decoder.readable.getReader();

        (async ()=>{
            while(true){
                const { value, done } = await serialReader.read();
                if (done) break;
                if (!value) continue;

                value.split(/\r?\n/).forEach(line=>{
                    const t = line.trim().toLowerCase();
                    if (!t) return;

                    if (t==="betul" || t==="salah"){
                        playerAnswer(t);
                    }
                });
            }
        })();

    } catch(e){
        console.error("Serial connection failed:", e);
        alert("Gagal menyambung ke Arduino/ESP32.");
    }
}

/* ============================================================
   12) INIT
============================================================ */
document.addEventListener("DOMContentLoaded",()=>{
    initUI();
    loadHallOfFame();

    if (typeof jsQR==="undefined"){
        console.warn("jsQR tidak ditemui.");
        if (el("cameraStatus")) el("cameraStatus").textContent = "jsQR tidak ditemui.";
    }
});

/* End of file */
