/* ============================================================
   1) SENARAI QR SAH (guna nama fail tanpa extension dlm qr_images)
   ============================================================ */
/* 4 GitHub Pages: folder repo root */
const QR_PATH = "static/qr_images/";

/* QR or Image je - adding, buang '//' pada nama tersebut. */
const validQRImages = [
    "granite",
    "gneiss",
    // "batu3",
    // "batu4",
    // ...
];

/* ============================================================
   2) KATEGORI BATU
   ============================================================ */
const rockCategory = {
    granite: "Igneus",
    gneiss: "Metamorf",
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
   3) PULL ELEMEN HTML
   ============================================================ */
const video = document.getElementById("video");
const statusText = document.getElementById("cameraStatus");
const timerText = document.getElementById("timer");
const scoreBox = document.getElementById("score");
const rockNameBox = document.getElementById("rockName");
const startBtn = document.getElementById("startScanBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

// overlay element (must exist in index.html with id="scannerOverlay")
const scannerOverlay = document.getElementById("scannerOverlay");

/* ============================================================
   4) SETTING GLOBAL
   ============================================================ */
let stream = null;
let scanning = false;         // locked while handling one QR (QR detected & handling)
let scanningActive = false;   // overall game active (kamera + scanning)
let timer = 30;
let timerInterval = null;

/* ============================================================
   5) AUDIO ( Add fail kemudian)
   ============================================================ */
// const scanSound = new Audio("static/sound/scan.mp3");   // bunyi QR sah
// const bonusSound = new Audio("static/sound/bonus.mp3"); // bunyi tambah masa
// const wrongSound = new Audio("static/sound/wrong.mp3"); // bunyi salah

/* ============================================================
   6) ANTI-SPAM QR (elak doublescan n crash)
   ============================================================ */
let lastQR = "";
let lastQRTime = 0;
const QR_COOLDOWN = 3000;

/* ============================================================
   7) (NO AUTOSTART) — Kamera aktif bila user tekan start
   ============================================================ */
/* Jangan panggil getUserMedia di sini; akan dipanggil oleh startCamera() */

/* ============================================================
   8) FULLSCREEN (butang) KIOSK Mode
   ============================================================ */
fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn("Gagal fullscreen:", err);
        });
    } else {
        document.exitFullscreen();
    }
});

/* ============================================================
   Overlay helpers (show/hide + small guard to avoid unnecessary DOM writes)
   ============================================================ */
function showOverlay() {
    if (!scannerOverlay) return;
    if (scannerOverlay.style.display === "block") return;
    scannerOverlay.style.display = "block";
}

function hideOverlay() {
    if (!scannerOverlay) return;
    if (scannerOverlay.style.display === "none") return;
    scannerOverlay.style.display = "none";
}

/* update overlay according to current state:
   Choice C: overlay visible only when scanningActive && !scanning (i.e. camera on and no QR detected)
*/
function updateOverlayState() {
    if (!scannerOverlay) return;
    if (scanningActive && !scanning) {
        showOverlay();
    } else {
        hideOverlay();
    }
}

/* ============================================================
   9) START / STOP GAME (TOGGLE) — Kamera hidup bila Mula Bermain
   ============================================================ */
startBtn.addEventListener("click", async () => {
    if (!scanningActive) {
        // START game
        const ok = await startCamera();
        if (!ok) return; // jika gagal access camera, jangan teruskan

        // ensure jsQR is available
        if (typeof jsQR !== "function") {
            console.error("jsQR library tidak ditemui. Pastikan <script src='...jsQR.js'></script> dimasukkan sebelum script.js");
            statusText.textContent = "jsQR tidak ditemui — scanner tidak boleh dijalankan.";
            stopCamera();
            return;
        }

        scanningActive = true;
        scanning = false;
        startBtn.textContent = "■ Tamat Permainan";
        statusText.textContent = "Kamera diaktifkan. Sedia untuk scan.";

        // Show overlay initially (Choice C: overlay visible when no QR detected)
        updateOverlayState();

        // start scanning loop
        requestAnimationFrame(scanQR);

        // Hantar signal ke Arduino (jika ada)
        sendToArduino("START");
    } else {
        // STOP game
        stopCamera();
        scanningActive = false;
        scanning = false;
        startBtn.textContent = "🎮 Mula Bermain";
        statusText.textContent = "Permainan dihentikan.";
        clearInterval(timerInterval);
        timerText.textContent = "-";
        scoreBox.textContent = "0";
        rockNameBox.textContent = "–";

        // hide overlay when stopped
        updateOverlayState();

        // Hantar signal ke Arduino (jika ada)
        sendToArduino("STOP");
    }
});

/* ============================================================
   10) START CAMERA (Setting)
   ============================================================ */
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        await video.play();

        // ensure overlay element is on top of video by making parent relative (HTML/CSS must have .video-box { position: relative; })
        if (scannerOverlay) {
            // hide by default until updateOverlayState decides
            scannerOverlay.style.display = "none";
        }
        return true;
    } catch (err) {
        console.error("Gagal akses kamera:", err);
        statusText.textContent = "Gagal mengakses kamera. Sila benarkan akses kamera.";
        return false;
    }
}

/* ============================================================
   11) STOP CAMERA (setting)
   ============================================================ */
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;
}

/* ============================================================
   12) SCAN QR SETIAP FRAME (bila scanningActive = true)
   ============================================================ */
function scanQR() {
    if (!scanningActive) return;           // if game not active, don't scan
    if (!stream) {
        requestAnimationFrame(scanQR);
        return;
    }

    // Update overlay according to state each frame (cheap guard avoids repeated DOM writes)
    updateOverlayState();

    const canvas = document.getElementById("qr-canvas") || document.createElement("canvas");
    // ensure canvas element exists in DOM for debugging (we have hidden canvas id in HTML)
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // some browsers throw if width/height are zero — guard
    if (canvas.width === 0 || canvas.height === 0) {
        requestAnimationFrame(scanQR);
        return;
    }

    let imageData;
    try {
        imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
        // security or other issues reading the frame
        console.warn("Tidak boleh baca imageData:", e);
        requestAnimationFrame(scanQR);
        return;
    }

    // decode QR using jsQR
    let qr = null;
    try {
        qr = jsQR(imageData.data, canvas.width, canvas.height);
    } catch (e) {
        console.error("jsQR error:", e);
    }

    if (!scanning && qr) {
        const raw = (qr.data || "").trim().toLowerCase(); // semua source nama fail mesti lowercase

        // ANTI-SPAM COOLDOWN
        const now = Date.now();
        if (raw === lastQR && (now - lastQRTime) < QR_COOLDOWN) {
            requestAnimationFrame(scanQR);
            return;
        }
        lastQR = raw;
        lastQRTime = now;

        // SEMAK QR SAH
        if (validQRImages.includes(raw)) {
            const fullQRPath = QR_PATH + raw + ".png";
            console.log("QR image path:", fullQRPath);

            scanning = true; // lock scanning while we handle this QR
            statusText.innerHTML = `QR dikesan: <b>${raw}</b> (sah)`;

            // Hide overlay immediately while handling (Choice C behaviour)
            hideOverlay();

            // Bunyi scan berjaya (nak pakai, keluarkan komen pada audio file)
            // scanSound.currentTime = 0;
            // scanSound.play();

            // tambah masa (bonus)
            timer += 5;
            if (timer > 30) timer = 30;

            // bonusSound.play();

            startTimer(raw);
        } else {
            statusText.textContent = "QR dikesan tetapi TIDAK sah.";

            // wrongSound.currentTime = 0;
            // wrongSound.play();
        }
    }

    requestAnimationFrame(scanQR);
}

/* ============================================================
   13) MULA TIMER
   ============================================================ */
function startTimer(rockName) {
    timer = 30;
    timerText.textContent = timer;

    // paparkan nama batu ikut rockName (jika mapping ada)
    rockNameBox.textContent = rockNameMapping(rockName);

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer--;
        timerText.textContent = timer;

        if (timer <= 0) {
            clearInterval(timerInterval);
            calculateScore(rockName);
        }
    }, 1000);
}

/* helper untuk mapping nama batu (jika ada dalam object rockCategory) */
function rockNameMapping(rawName) {
    if (!rawName) return "–";
    // rawName datang tanpa extension; rockCategory keys are without extension
    if (rockCategory[rawName]) return `${rawName} — ${rockCategory[rawName]}`;
    return rawName;
}

/* ============================================================
   14) KIRA SKOR & RESET
   ============================================================ */
function calculateScore(rockName) {
    clearInterval(timerInterval);

    const used = 30 - timer;
    const score = Math.max(1, Math.min(10, 10 - Math.floor(used / 3))));

    scoreBox.textContent = score;

    // beri feedback ke Arduino: CORRECT/WRONG
    // (bergantung pada kategori yang dipilih oleh pemain; integrasi di chooseCategory)
    // sendToArduino("SCORE:" + score);

    setTimeout(() => {
        statusText.textContent = "Sedia untuk scan seterusnya.";
        timerText.textContent = "-";
        scoreBox.textContent = "0";

        scanning = false;
        timer = 30;

        // Clear last QR (so same QR can be scanned again later)
        lastQR = "";
        lastQRTime = 0;

        // Resume overlay (Choice C: overlay visible when no QR detected)
        updateOverlayState();

    }, 3000);
}

/* ============================================================
   15) PILIH KATEGORI (button panel) — jika anda mahu hantar ke Arduino
   ============================================================ */
function chooseCategory(cat) {
    // cat = 'igneous' / 'sedimentary' / 'metamorphic' / 'mineral'
    // sambungkan logik untuk nilaikan betul / salah.
    // eg: bandingkan dengan rockCategory[currentQR]
    sendToArduino("CAT:" + cat);
    console.log("Category chosen:", cat);
}

/* expose chooseCategory kepada onclick inline pada HTML */
window.chooseCategory = chooseCategory;

/* ============================================================
   16) ARDUINO INTEGRATION (Web Serial API)
       - checkbox initially disabled until device found/connected
       - auto detect connect/disconnect events (if supported)
   ============================================================ */
const arduinoCheckbox = document.getElementById("arduinoMode");
const connectBtn = document.getElementById("connectArduinoBtn");

let serialPort = null;
let serialReader = null;
let serialWriter = null;

// make checkbox disabled initially
if (arduinoCheckbox) arduinoCheckbox.disabled = true;

/* Auto-detect events (may not be supported in all browsers) */
if ("serial" in navigator) {
    navigator.serial.addEventListener("connect", (e) => {
        console.log("Serial device connected:", e);
        if (arduinoCheckbox) {
            arduinoCheckbox.disabled = false;
            connectBtn.textContent = "Arduino Available (Click to Connect)";
            connectBtn.style.background = "#0066cc";
        }
    });

    navigator.serial.addEventListener("disconnect", (e) => {
        console.log("Serial device disconnected:", e);
        if (arduinoCheckbox) {
            arduinoCheckbox.checked = false;
            arduinoCheckbox.disabled = true;
            connectBtn.textContent = "Connect Arduino";
            connectBtn.style.background = "";
        }
        // close streams if needed
        if (serialReader) {
            try { serialReader.cancel(); } catch (e) {}
            serialReader = null;
        }
        if (serialWriter) {
            try { serialWriter.close(); } catch (e) {}
            serialWriter = null;
        }
        if (serialPort) {
            try { serialPort.close(); } catch (e) {}
            serialPort = null;
        }
    });
} else {
    console.warn("Web Serial API not supported in this browser.");
    // leave checkbox disabled — user can still manually toggle if you want
}

/* Connect button click */
connectBtn.addEventListener("click", async () => {
    if (!("serial" in navigator)) {
        alert("Web Serial API tidak disokong pada pelayar ini. Gunakan Chrome/Edge dan akses melalui HTTPS atau localhost.");
        return;
    }

    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 9600 });

        // setup reader
        const textDecoder = new TextDecoderStream();
        serialPort.readable.pipeTo(textDecoder.writable);
        serialReader = textDecoder.readable.getReader();

        // setup writer
        const textEncoder = new TextEncoderStream();
        textEncoder.readable.pipeTo(serialPort.writable);
        serialWriter = textEncoder.writable.getWriter();

        // enable checkbox
        if (arduinoCheckbox) {
            arduinoCheckbox.disabled = false;
            connectBtn.textContent = "Arduino Connected ✓";
            connectBtn.style.background = "#28a745";
        }

        // start listening
        listenToArduino();

    } catch (err) {
        console.error("Gagal sambung ke Arduino:", err);
        connectBtn.textContent = "Connect Arduino (Fail)";
        connectBtn.style.background = "#b30000";
    }
});

/* Read loop from Arduino */
async function listenToArduino() {
    try {
        while (true) {
            const { value, done } = await serialReader.read();
            if (done) break;
            if (!value) continue;
            const msg = value.trim();
            console.log("Arduino ->", msg);

            // contoh: Arduino hantar "BTN:igneous" bila button fizikal ditekan
            if (msg.startsWith("BTN:")) {
                const btn = msg.split(":")[1];
                // trigger client-side chooseCategory
                chooseCategory(btn);
            }

            // tambah handling lain kat sini
        }
    } catch (err) {
        console.error("Error baca serial:", err);
    }
}

/* Hantar data ke Arduino —if checkbox ticked dan writer tersedia */
function sendToArduino(msg) {
    if (!arduinoCheckbox || !arduinoCheckbox.checked) return;
    if (!serialWriter) return;
    try {
        serialWriter.write(msg + "\n");
    } catch (err) {
        console.warn("Gagal hantar ke Arduino:", err);
    }
}

/* ============================================================
   17) HALL OF FAME & UTILS (enhance mode)
   ============================================================ */
function saveHallOfFame() {
    const nameEl = document.getElementById("playerName");
    const finalScore = document.getElementById("finalScore");
    const name = (nameEl && nameEl.value) ? nameEl.value : "Tanpa Nama";
    const score = finalScore ? parseInt(finalScore.textContent || "0") : 0;

    const rec = { name, score, date: new Date().toISOString() };
    const arr = JSON.parse(localStorage.getItem("hof") || "[]");
    arr.push(rec);
    localStorage.setItem("hof", JSON.stringify(arr));
    loadHallOfFame();
}

function loadHallOfFame() {
    const list = document.getElementById("hofList");
    if (!list) return;

    list.innerHTML = "";

    let arr = JSON.parse(localStorage.getItem("hof") || "[]");

    // sort dari score tertinggi → rendah
    arr.sort((a, b) => b.score - a.score);

    arr.forEach((r, index) => {
        const li = document.createElement("li");

        // Tambah ranking + content
        li.innerHTML = `<b>${index + 1}.</b> ${r.name} — ${r.score}`;

        // Tambah class untuk animasi slide-in
        li.classList.add("hof-item");

        // Highlight top score (ranking #1)
        if (index === 0) {
            li.classList.add("top-score");
        }

        list.appendChild(li);
    });
}
loadHallOfFame();

/* ============================================================
   18) OPTIONAL: pilih kategori UI hooking (untuk butang di HTML)
   ============================================================ */
window.chooseCategory = function(cat) {
    // anda boleh semak jika jawapan ini betul utk batu terakhir (raw)
    // Sekarang hanya menghantar ke Arduino dan console
    console.log("Player choose:", cat);
    sendToArduino("CATEGORY:" + cat.toUpperCase());
};
