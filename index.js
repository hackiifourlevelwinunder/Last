const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

let currentResult = null;
let previousResult = null;

function generateDiceRoll() {
  return Math.floor(crypto.randomInt(1, 7)); // 1–6
}

function generateRound() {
  const dice = [generateDiceRoll(), generateDiceRoll(), generateDiceRoll()];
  const final = dice.reduce((a, b) => a + b, 0);

  const result = {
    dice,
    final,
    timestamp: new Date().toISOString()
  };

  previousResult = currentResult;
  currentResult = result;

  io.emit("result", {
    current: currentResult,
    previous: previousResult
  });

  console.log("New Round:", result);
}

// First round immediately
generateRound();

// Every 60s new round
setInterval(generateRound, 60000);

io.on("connection", (socket) => {
  console.log("Client connected");

  if (currentResult) {
    socket.emit("result", {
      current: currentResult,
      previous: previousResult
    });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
