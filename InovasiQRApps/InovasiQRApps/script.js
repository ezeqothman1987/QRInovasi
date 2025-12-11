/* =============================================================
   QR GEO GAME — Full Version
   With UI, Fullscreen, Timer, Arduino Mode, Hall of Fame, QR Gallery
   ============================================================= */

const CATEGORIES = {
    igneous: ["granite", "basalt", "andesite", "rhyolite"],
    sedimentary: ["limestone", "sandstone", "shale", "conglomerate"],
    metamorphic: ["gneiss", "schist", "quartzite", "phyllite"]
};

let gameActive = false;
let score = 0;
let timer = null;
let timeLeft = 10;
let currentRockName = "";
let currentCategory = "";

let arduinoMode = false;
let arduinoPort = null;
let arduinoReader = null;

let video = null;
let canvasElement = null;
let canvas = null;
let scanning = false;
let cameraStream = null;


document.addEventListener("DOMContentLoaded", () => {
    video = document.getElementById("video");
    canvasElement = document.getElementById("qr-canvas");
    canvas = canvasElement.getContext("2d");
    
    loadHallOfFame();
    loadQRGallery();
    
    document.getElementById("fullscreenBtn").onclick = () => {
        document.documentElement.requestFullscreen();
    };
    
    document.getElementById("connectArduinoBtn").onclick = connectArduino;
    
    document.getElementById("arduinoMode").onchange = (e) => {
        arduinoMode = e.target.checked;
    };
    
    document.getElementById("startScanBtn").onclick = startCamera;
    
    document.getElementById("uploadBtn").onclick = uploadQRImages;
});


function loadHallOfFame() {
    const list = JSON.parse(localStorage.getItem("hallOfFame") || "[]");
    const hofList = document.getElementById("hofList");
    hofList.innerHTML = list
        .map(p => `<li>${p.name} — ${p.score}</li>`)
        .join("");
}


function saveHallOfFame() {
    const nameInput = document.getElementById("playerName");
    const name = nameInput.value.trim();
    if (name.length === 0) return;
    
    const list = JSON.parse(localStorage.getItem("hallOfFame") || "[]");
    list.push({ name, score });
    list.sort((a, b) => b.score - a.score);
    localStorage.setItem("hallOfFame", JSON.stringify(list.slice(0, 10)));
    loadHallOfFame();
    
    document.getElementById("endModal").style.display = "none";
    resetGame();
}


async function loadQRGallery() {
    try {
        const response = await fetch('/qr-images');
        const images = await response.json();
        
        const gallery = document.getElementById("qrGallery");
        gallery.innerHTML = "";
        
        if (images.length === 0) {
            gallery.innerHTML = "<p class='no-images'>Tiada gambar. Upload QR codes.</p>";
            return;
        }
        
        images.forEach(filename => {
            const div = document.createElement("div");
            div.className = "qr-item";
            
            const img = document.createElement("img");
            img.src = `/static/qr_images/${filename}`;
            img.alt = filename;
            img.onclick = () => simulateScan(filename);
            
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "delete-btn";
            deleteBtn.textContent = "×";
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteQRImage(filename);
            };
            
            div.appendChild(img);
            div.appendChild(deleteBtn);
            gallery.appendChild(div);
        });
    } catch (err) {
        console.error("Failed to load QR gallery:", err);
    }
}


async function uploadQRImages() {
    const input = document.getElementById("qrUpload");
    const files = input.files;
    
    if (files.length === 0) {
        alert("Sila pilih fail untuk upload");
        return;
    }
    
    for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        
        try {
            const response = await fetch("/upload", {
                method: "POST",
                body: formData
            });
            
            const result = await response.json();
            if (!result.success) {
                alert("Gagal upload: " + (result.error || "Unknown error"));
            }
        } catch (err) {
            alert("Error uploading: " + err.message);
        }
    }
    
    input.value = "";
    loadQRGallery();
}


async function deleteQRImage(filename) {
    if (!confirm(`Padam ${filename}?`)) return;
    
    try {
        await fetch(`/delete-image/${filename}`, { method: "DELETE" });
        loadQRGallery();
    } catch (err) {
        alert("Gagal padam: " + err.message);
    }
}


function simulateScan(filename) {
    const rockName = filename.replace(/\.[^/.]+$/, "").toLowerCase();
    onQRDetected(rockName);
}


function startCamera() {
    const statusEl = document.getElementById("cameraStatus");
    const startBtn = document.getElementById("startScanBtn");
    
    statusEl.textContent = "Meminta akses kamera...";
    
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 }
        } 
    })
    .then(stream => {
        cameraStream = stream;
        video.srcObject = stream;
        video.play();
        
        scanning = true;
        gameActive = true;
        startBtn.style.display = "none";
        statusEl.textContent = "Kamera aktif - scan QR code";
        
        requestAnimationFrame(scanQR);
        startTimer();
    })
    .catch(err => {
        console.error("Camera error:", err);
        statusEl.textContent = "Kamera gagal: " + err.message;
        statusEl.style.color = "#e74c3c";
    });
}


function stopCamera() {
    scanning = false;
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    video.srcObject = null;
}


function scanQR() {
    if (!scanning) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.height = video.videoHeight;
        canvasElement.width = video.videoWidth;
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        
        if (code && code.data) {
            onQRDetected(code.data);
        }
    }
    
    requestAnimationFrame(scanQR);
}


function startTimer() {
    timeLeft = 10;
    updateTimerUI();
    
    if (timer) clearInterval(timer);
    timer = setInterval(countdown, 1000);
}


function countdown() {
    timeLeft--;
    updateTimerUI();
    
    if (timeLeft <= 0) {
        wrongAnswer();
    }
}


function updateTimerUI() {
    document.getElementById("timer").textContent = timeLeft;
}


function onQRDetected(text) {
    currentRockName = text.toLowerCase().trim();
    
    currentCategory = "";
    for (const cat in CATEGORIES) {
        if (CATEGORIES[cat].includes(currentRockName)) {
            currentCategory = cat;
            break;
        }
    }
    
    document.getElementById("rockName").textContent = currentRockName.toUpperCase();
    
    if (currentCategory) {
        startTimer();
    } else {
        document.getElementById("cameraStatus").textContent = 
            `"${currentRockName}" tidak dikenali. Cuba lagi.`;
    }
}


function chooseCategory(selected) {
    if (!gameActive) {
        alert("Sila tekan 'Mula Scan QR' dahulu!");
        return;
    }
    if (!currentRockName || currentRockName === "–") {
        alert("Sila scan QR batu dahulu!");
        return;
    }
    
    if (arduinoMode) return;
    
    checkAnswer(selected);
}


function checkAnswer(selected) {
    if (!gameActive) return;
    
    if (selected === currentCategory) {
        correctAnswer();
    } else {
        wrongAnswer();
    }
}


function correctAnswer() {
    score++;
    document.getElementById("score").textContent = score;
    document.getElementById("cameraStatus").textContent = "✓ Betul! Scan QR seterusnya...";
    document.getElementById("cameraStatus").style.color = "#2ecc71";
    
    clearInterval(timer);
    
    currentRockName = "";
    currentCategory = "";
    document.getElementById("rockName").textContent = "Scan QR seterusnya...";
    
    setTimeout(() => {
        document.getElementById("cameraStatus").style.color = "#aaa";
        startTimer();
    }, 1000);
}


function wrongAnswer() {
    document.getElementById("cameraStatus").textContent = "✗ Salah!";
    document.getElementById("cameraStatus").style.color = "#e74c3c";
    clearInterval(timer);
    endGame();
}


function endGame() {
    gameActive = false;
    stopCamera();
    
    document.getElementById("finalScore").textContent = score;
    document.getElementById("endModal").style.display = "block";
}


function resetGame() {
    score = 0;
    document.getElementById("score").textContent = "0";
    document.getElementById("rockName").textContent = "–";
    document.getElementById("timer").textContent = "–";
    document.getElementById("playerName").value = "";
    document.getElementById("cameraStatus").textContent = "";
    document.getElementById("cameraStatus").style.color = "#aaa";
    document.getElementById("startScanBtn").style.display = "block";
    
    currentRockName = "";
    currentCategory = "";
}


async function connectArduino() {
    try {
        arduinoPort = await navigator.serial.requestPort();
        await arduinoPort.open({ baudRate: 9600 });
        
        const decoder = new TextDecoderStream();
        arduinoPort.readable.pipeTo(decoder.writable);
        arduinoReader = decoder.readable.getReader();
        
        document.getElementById("arduinoMode").checked = true;
        arduinoMode = true;
        
        listenArduino();
        alert("Arduino berjaya disambung!");
    } catch (e) {
        alert("Tidak dapat sambung Arduino: " + e.message);
    }
}


async function listenArduino() {
    while (arduinoMode && arduinoReader) {
        try {
            const { value, done } = await arduinoReader.read();
            if (done) break;
            
            if (!value) continue;
            
            const input = value.trim();
            if (input === "1") checkAnswer("igneous");
            if (input === "2") checkAnswer("sedimentary");
            if (input === "3") checkAnswer("metamorphic");
        } catch (e) {
            console.error("Arduino read error:", e);
            break;
        }
    }
}
