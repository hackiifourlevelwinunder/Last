const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let lastResult = null;
let history = [];

function generateResult() {
  return crypto.randomInt(3, 19); // 3 dice total 3–18
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

    // 🔹 Preview at 25s (final se 35s pehle)
    if (sec === 25) {
      const previewResult = generateResult();
      broadcast({
        type: "preview",
        result: previewResult,
        previous: lastResult,
        history
      });
    }

    // 🔹 Final at 0s (new minute)
    if (sec === 0) {
      const finalResult = generateResult();
      lastResult = finalResult;

      history.unshift(finalResult);
      if (history.length > 10) history.pop();

      broadcast({
        type: "final",
        result: finalResult,
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
