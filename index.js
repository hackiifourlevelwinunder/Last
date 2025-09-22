const express = require("express");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend (index.html)
app.use(express.static("public"));

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// WebSocket setup
const wss = new WebSocketServer({ server });

// Variables for RNG state
let currentRound = null;
let previousRound = null;
let history = [];

// Function to generate 25 secure random tokens (0–9)
function generateRound() {
  let counts = {};
  for (let i = 0; i < 10; i++) counts[i] = 0;

  let tokens = [];
  for (let i = 0; i < 25; i++) {
    const digit = crypto.randomInt(0, 10); // 0–9
    tokens.push(digit);
    counts[digit]++;
  }

  const finalDigit = tokens[tokens.length - 1]; // Last token
  return {
    start: new Date().toISOString(),
    tokens,
    counts,
    final: finalDigit
  };
}

// Function to start new round
function startNewRound() {
  if (currentRound) {
    previousRound = currentRound;
    history.unshift(currentRound.final);
    if (history.length > 10) history.pop();
  }

  currentRound = generateRound();
  console.log("🎲 New Round:", currentRound);

  broadcastState();
}

// Send state to clients
function broadcastState() {
  const state = {
    currentRound,
    previousRound,
    history,
    serverTime: new Date().toISOString()
  };
  const msg = JSON.stringify(state);

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

// WebSocket connection
wss.on("connection", (ws) => {
  console.log("🔗 Client connected");
  ws.send(
    JSON.stringify({
      currentRound,
      previousRound,
      history,
      serverTime: new Date().toISOString()
    })
  );
});

// Run every 60s exactly, no skipping
function alignToMinute() {
  const ms = 60000 - (Date.now() % 60000);
  setTimeout(() => {
    startNewRound();
    setInterval(startNewRound, 60000);
  }, ms);
}

// Start the loop
alignToMinute();
