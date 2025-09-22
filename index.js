const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let lastResult = null;
let history = [];

// 🎲 CSPRNG → 25 token bytes generate karke 0-9 number banayenge
function generateResult() {
  const buffer = crypto.randomBytes(25); // 25 token
  const numbers = [];

  for (let i = 0; i < buffer.length; i++) {
    numbers.push(buffer[i] % 10); // 0–9
  }

  // frequency check → sab tokens ka distribution
  const freq = {};
  numbers.forEach(n => freq[n] = (freq[n] || 0) + 1);

  // final number choose karo → 25 tokens ka sum % 10
  const final = numbers.reduce((a, b) => a + b, 0) % 10;

  return { final, tokens: numbers, freq };
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

    // 🔹 Preview (35s pehle → 25s par)
    if (sec === 25) {
      const { final, tokens, freq } = generateResult();
      broadcast({
        type: "preview",
        preview: final,
        tokens,
        freq,
        previous: lastResult,
        history
      });
    }

    // 🔹 Final (0s par → har minute lock)
    if (sec === 0) {
      const { final, tokens, freq } = generateResult();
      lastResult = final;

      history.unshift(final);
      if (history.length > 20) history.pop();

      broadcast({
        type: "final",
        result: final,
        tokens,
        freq,
        previous: lastResult,
        history
      });
    }
  }, 1000);
}

app.use(express.static("public"));

server.listen(process.env.PORT || 10000, () => {
  console.log("✅ CSPRNG Live Final running...");
  startScheduler();
});
