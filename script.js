/* ============================================================
   1) SENARAI QR SAH (nama fail tanpa .format)
   ============================================================ */
const QR_PATH = "/static/qr_images/";

const validQRImages = [
    "qr", "batu2", "batu3", "batu4", "batu5",
    "batu6", "batu7", "batu8", "batu9", "batu10",
    "batu11", "batu12", "batu13", "batu14", "batu15"
];

/* ============================================================
   2) KATEGORI BATU
   ============================================================ */
const rockCategory = {
    qr: "Igneus",
    batu2: "Igneus",
    batu3: "Sedimen",
    batu4: "Sedimen",
    batu5: "Metamorf",
    batu6: "Metamorf",
    batu7: "Mineral",
    batu8: "Igneus",
    batu9: "Sedimen",
    batu10: "Metamorf",
    batu11: "Mineral",
    batu12: "Igneus",
    batu13: "Sedimen",
    batu14: "Metamorf",
    batu15: "Mineral"
};

/* ============================================================
   3) AMBIL ELEMEN HTML
   ============================================================ */
const video = document.getElementById("video");
const statusText = document.getElementById("cameraStatus");
const timerText = document.getElementById("timer");
const scoreBox = document.getElementById("score");

/* ============================================================
   4) PEMBOLEH UBAH GLOBAL
   ============================================================ */
let stream;
let scanning = false;
let timer = 30;
let timerInterval = null;

/* ============================================================
   5) AUDIO
   ============================================================ */
// const scanSound = new Audio("/static/sound/contoh.mp3");   // bunyi QR sah
// const bonusSound = new Audio("/static/sound/bonus.mp3");     // bunyi tambah masa
// const wrongSound = new Audio("/static/sound/wrong.mp3");     // bunyi salah

/* ============================================================
   6) ANTI-SPAM QR
   ============================================================ */
let lastQR = "";
let lastQRTime = 0;
const QR_COOLDOWN = 3000;

/* ============================================================
   7) AKTIFKAN KAMERA
   ============================================================ */
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
.then(s => {
    stream = s;
    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    video.play();
    requestAnimationFrame(scanQR);
});

/* ============================================================
   8) SCAN QR SETIAP FRAME
   ============================================================ */
function scanQR() {

    if (!scanning) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, canvas.width, canvas.height);

        if (qr) {
            const raw = qr.data.trim().toLowerCase();

            /* -------------------------------------
               ANTI-SPAM COOLDOWN
               ------------------------------------- */
            const now = Date.now();
            if (raw === lastQR && (now - lastQRTime) < QR_COOLDOWN) {
                requestAnimationFrame(scanQR);
                return;
            }
            lastQR = raw;
            lastQRTime = now;

            /* -------------------------------------
               SEMAK QR SAH
               ------------------------------------- */
            if (validQRImages.includes(raw)) {

                const fullQRPath = QR_PATH + raw + ".png";
                console.log("QR image path:", fullQRPath);

                scanning = true;
                statusText.innerHTML = `QR dikesan: <b>${raw}</b> (sah)`;

                // Bunyi scan berjaya
                // scanSound.currentTime = 0;
                // scanSound.play();

                timer += 5;
                if (timer > 30) timer = 30;

                // bonusSound.play();

                startTimer(raw);

            } else {
                statusText.textContent = "QR dikesan tetapi TIDAK sah.";

                // Bunyi salah
                // wrongSound.currentTime = 0;
                // wrongSound.play();
            }
        }
    }

    requestAnimationFrame(scanQR);
}

/* ============================================================
   9) MULA TIMER
   ============================================================ */
function startTimer(rockName) {
    timer = 30;
    timerText.textContent = timer;

    timerInterval = setInterval(() => {
        timer--;
        timerText.textContent = timer;

        if (timer <= 0) {
            clearInterval(timerInterval);
            calculateScore(rockName);
        }

    }, 1000);
}

/* ============================================================
   10) KIRA SKOR & RESET
   ============================================================ */
function calculateScore(rockName) {

    clearInterval(timerInterval);

    const used = 30 - timer;
    const score = Math.max(1, Math.min(10, 10 - Math.floor(used / 3)));

    scoreBox.textContent = score;

    setTimeout(() => {

        statusText.textContent = "Sedia untuk scan batu seterusnya.";
        timerText.textContent = "-";
        scoreBox.textContent = "0";

        scanning = false;
        timer = 30;

        lastQR = "";
        lastQRTime = 0;

    }, 3000);
}
