const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let currentResult = null;
let previousResult = null;
let roundStart = Date.now();

function generateResult() {
  const dice = [
    crypto.randomInt(1, 7),
    crypto.randomInt(1, 7),
    crypto.randomInt(1, 7)
  ];
  const total = dice[0] + dice[1] + dice[2];
  return { dice, total, timestamp: new Date().toISOString() };
}

function startNewRound() {
  previousResult = currentResult;
  currentResult = generateResult();
  roundStart = Date.now();

  io.emit("newRound", {
    previous: previousResult,
    current: currentResult
  });
}

setInterval(startNewRound, 60000);
startNewRound();

io.on("connection", (socket) => {
  console.log("Client connected");
  socket.emit("newRound", {
    previous: previousResult,
    current: currentResult
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
