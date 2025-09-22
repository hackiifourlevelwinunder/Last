const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let lastResult = null;
let history = [];
let lockedRound = null; // preview ke liye locked data

// 🎲 CSPRNG → 25 token bytes generate karke 0-9 number banayenge
function generateRound() {
  const buffer = crypto.randomBytes(25); // 25 tokens
  const tokens = [];
  for (let i = 0; i < buffer.length; i++) tokens.push(buffer[i] % 10);

  const freq = {};
  tokens.forEach(n => freq[n] = (freq[n] || 0) + 1);

  const final = tokens.reduce((a, b) => a + b, 0) % 10; // 0–9
  return { final, tokens, freq };
}

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function startScheduler() {
  setInterval(() => {
    const now = new Date();
    const sec = now.getUTCSeconds();

    // 🔹 Preview (25s pe → final se 35s pehle)
    if (sec === 25) {
      lockedRound = generateRound();
      broadcast({
        type: "preview",
        preview: lockedRound.final,
        tokens: lockedRound.tokens,
        freq: lockedRound.freq,
        previous: lastResult,
        history
      });
    }

    // 🔹 Final (0s pe)
    if (sec === 0 && lockedRound) {
      lastResult = lockedRound.final;
      history.unshift(lastResult);
      if (history.length > 20) history.pop();

      broadcast({
        type: "final",
        result: lockedRound.final,
        tokens: lockedRound.tokens,
        freq: lockedRound.freq,
        previous: lastResult,
        history
      });

      lockedRound = null; // reset after final
    }
  }, 1000);
}

app.use(express.static("public"));

server.listen(process.env.PORT || 10000, () => {
  console.log("✅ CSPRNG Live Final running...");
  startScheduler();
});￼Enter
