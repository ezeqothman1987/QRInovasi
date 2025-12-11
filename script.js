/* ===========================
   KONFIG QR UNTUK GITHUB
   =========================== */

const QR_PATH = "static/qr_images/"; 

// Hanya qr.jpeg ada – yang lain placeholder
const validQRImages = [
    "qr.jpeg",
    // "batuan1.jpeg",
    // "batuan2.jpeg",
    // "sedimen1.jpeg",
    // "igneus1.jpeg",
    // "metamorph1.jpeg",
];

/* ===========================
   ELEMENT HTML
   =========================== */

const startBtn = document.getElementById("startBtn");
const rockNameEl = document.getElementById("rockName");
const timeLeftEl = document.getElementById("timeLeft");
const scoreEl = document.getElementById("score");
const answerBtns = document.querySelectorAll(".answerBtn");

const gameArea = document.getElementById("gameArea");
const endScreen = document.getElementById("endScreen");
const finalScoreEl = document.getElementById("finalScore");
const playerNameInput = document.getElementById("playerName");
const saveScoreBtn = document.getElementById("saveScoreBtn");
const hallOfFameList = document.getElementById("hallOfFame");

const arduinoToggle = document.getElementById("arduinoToggle");
const connectBtn = document.getElementById("connectBtn");

/* ===========================
   GAME VARIABLES
   =========================== */

let timeLeft = 20;
let score = 0;
let timer;
let correctAnswer = "";
let port = null;
let writer = null;

/* ===========================
   ARDUINO SETUP (Web Serial)
   =========================== */

connectBtn.addEventListener("click", async () => {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        writer = port.writable.getWriter();
        console.log("Arduino connected.");
        connectBtn.innerText = "Arduino Connected";
    } catch (e) {
        alert("Tidak dapat sambung Arduino");
    }
});

async function arduinoSend(data) {
    if (arduinoToggle.checked && writer) {
        await writer.write(new TextEncoder().encode(data));
    }
}

/* ===========================
   GAME LOGIC
   =========================== */

function startGame() {
    score = 0;
    scoreEl.textContent = score;

    gameArea.classList.remove("hidden");
    endScreen.classList.add("hidden");

    pickQR();
    startTimer();
}

startBtn.addEventListener("click", startGame);

function pickQR() {
    const randomQR = validQRImages[Math.floor(Math.random() * validQRImages.length)];
    const qrName = randomQR.replace(".jpeg", "").replace(".png", "");

    rockNameEl.textContent = qrName.toUpperCase();

    // Set jawapan betul simplistik
    if (qrName.includes("igneus")) correctAnswer = "Igneus";
    else if (qrName.includes("sedimen")) correctAnswer = "Sedimen";
    else if (qrName.includes("meta")) correctAnswer = "Metamorph";
    else correctAnswer = "Mineral";

    // Trigger Arduino LED
    arduinoSend("LED_ON\n");
}

function startTimer() {
    timeLeft = 20;
    timeLeftEl.textContent = timeLeft;

    timer = setInterval(() => {
        timeLeft--;
        timeLeftEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

answerBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        if (btn.textContent === correctAnswer) {
            score++;
            scoreEl.textContent = score;
            
            // Arduino buzzer betul
            arduinoSend("BUZZ_CORRECT\n");

        } else {
            // Arduino buzzer salah
            arduinoSend("BUZZ_WRONG\n");
        }

        pickQR();
    });
});

function endGame() {
    clearInterval(timer);
    finalScoreEl.textContent = score;
    endScreen.classList.remove("hidden");

    // Arduino off LED/buzzer
    arduinoSend("END\n");
}

/* ===========================
   HALL OF FAME
   =========================== */

saveScoreBtn.addEventListener("click", () => {
    const name = playerNameInput.value || "Tanpa Nama";

    const record = { name, score };
    let records = JSON.parse(localStorage.getItem("hallOfFame") || "[]");

    records.push(record);
    localStorage.setItem("hallOfFame", JSON.stringify(records));

    loadHallOfFame();
});

function loadHallOfFame() {
    hallOfFameList.innerHTML = "";
    const records = JSON.parse(localStorage.getItem("hallOfFame") || "[]");

    records.sort((a, b) => b.score - a.score);

    records.forEach(r => {
        let li = document.createElement("li");
        li.textContent = `${r.name} — ${r.score}`;
        hallOfFameList.appendChild(li);
    });
}

loadHallOfFame();
