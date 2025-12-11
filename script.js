/* ============================================================
   1) SENARAI QR SAH (menggantikan membaca folder /static/qr_images)
      Perlu tukar nama fail kemudian.
   ============================================================ */
const validQRImages = [
    "batu1.png", "batu2.png", "batu3.png", "batu4.png", "batu5.png",
    "batu6.png", "batu7.png", "batu8.png", "batu9.png", "batu10.png",
    "batu11.png", "batu12.png", "batu13.png", "batu14.png", "batu15.png"
];

/* ============================================================
   2) KATEGORI BATU
   ============================================================ */
const rockCategory = {
    batu1: "Igneus",
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

let stream;
let scanning = false;
let timer = 30;
let timerInterval = null;

/* ============================================================
   4) AKTIFKAN KAMERA
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
   5) FUNGSI SCAN QR SETIAP FRAME
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

            /* VALIDASI QR: mesti match salah satu fail batu */
            if (validQRImages.includes(expectedFilename)) {
                scanning = true;
                statusText.innerHTML = `QR dikesan: <b>${raw}</b> (sah)`;
                startTimer(raw);
            } else {
                statusText.textContent = "QR dikesan tetapi TIDAK sah.";
            }
        }
    }

    requestAnimationFrame(scanQR);
}

/* ============================================================
   6) TIMER 30 SAAT (mula hanya bila QR sah)
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

    let correctCategory = rockCategory[rockName];
    console.log("Kategori untuk", rockName, "ialah", correctCategory);

    // Di sini anda boleh paparkan soalan / UI jika perlu
}

/* ============================================================
   7) KIRA SKOR (10 → 1 ikut kepantasan)
   ============================================================ */
function calculateScore(rockName) {
    clearInterval(timerInterval);

    const used = 30 - timer;

    const score = Math.max(1, Math.min(10, 10 - Math.floor(used / 3)));

    scoreBox.innerHTML = `Markah anda: <b>${score}</b>`;
}
