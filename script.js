/* ============================================================
   1) SENARAI QR SAH
   ============================================================ */
const validQRImages = [
    "qr.jpeg", "batu2.png", "batu3.png", "batu4.png", "batu5.png",
    "batu6.png", "batu7.png", "batu8.png", "batu9.png", "batu10.png",
    "batu11.png", "batu12.png", "batu13.png", "batu14.png", "batu15.png"
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
const statusText = document.getElementById("status");
const timerText = document.getElementById("timerDisplay");
const scoreBox = document.getElementById("scoreBox");

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
//const scanSound = new Audio("/static/sound/contoh.mp3");        // bunyi QR sah
//const bonusSound = new Audio("/static/sound/bonus.mp3");        // bunyi tambah masa
//const wrongSound = new Audio("/static/sound/wrong.mp3");        // bunyi salah

/* ============================================================
   6) ANTI-SPAM QR
   ============================================================ */
let lastQR = "";
let lastQRTime = 0;
const QR_COOLDOWN = 3000; // 3 saat

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
            const expectedFilename = raw + ".png";

            /* ======================================================
               ANTI-SPAM: elak QR sama dibaca 2x dalam 3s
               ====================================================== */
            const now = Date.now();
            if (raw === lastQR && (now - lastQRTime) < QR_COOLDOWN) {
                requestAnimationFrame(scanQR);
                return;
            }
            lastQR = raw;
            lastQRTime = now;

            /* ======================================================
               QR SAH
               ====================================================== */
            if (validQRImages.includes(expectedFilename)) {

                scanning = true;
                statusText.innerHTML = `QR dikesan: <b>${raw}</b> (sah)`;

                //Bunyi scan berjaya
                //scanSound.currentTime = 0;
                //scanSound.play();

                /* -----------------------------------------------
                   BONUS MASA (ditambah) → anda boleh ubah / buang
                   ----------------------------------------------- */
                timer += 5;
                if (timer > 30) timer = 30;
                //bonusSound.play();

                startTimer(raw);

            } else {
                /* ======================================================
                   QR TIDAK SAH
                   ====================================================== */
                statusText.textContent = "QR dikesan tetapi TIDAK sah.";

                //Bunyi salah
                //wrongSound.currentTime = 0;
                //wrongSound.play();
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
    timerText.textContent = "Timer: 30";

    timerInterval = setInterval(() => {
        timer--;
        timerText.textContent = "Timer: " + timer;

        if (timer <= 0) {
            clearInterval(timerInterval);
            calculateScore(rockName);
        }
    }, 1000);
}

/* ============================================================
   10) KIRA SKOR + AUTO RESET
   ============================================================ */
function calculateScore(rockName) {

    clearInterval(timerInterval);

    const used = 30 - timer;
    const score = Math.max(1, Math.min(10, 10 - Math.floor(used / 3)));

    scoreBox.innerHTML = `Markah anda: <b>${score}</b>`;

    /* AUTO RESET 3s */
    setTimeout(() => {
        statusText.textContent = "Sedia untuk scan batu seterusnya.";
        timerText.textContent = "Timer: -";
        scoreBox.innerHTML = "";

        scanning = false;
        timer = 30;

        lastQR = "";        // reset anti-spam
        lastQRTime = 0;

    }, 3000);
}
