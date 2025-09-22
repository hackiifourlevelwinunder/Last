const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

// Serve static files from public folder
app.use(express.static("public"));

// RNG function (3 dice roll)
function generateDiceResult() {
  const dice = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
  const total = dice.reduce((a, b) => a + b, 0);
  const size = total >= 11 ? "BIG" : "SMALL";
  return { dice, total, size, time: new Date().toISOString() };
}

// Emit new result every 60s (40s pehle dikha dena possible with scheduling)
setInterval(() => {
  const result = generateDiceResult();
  io.emit("newResult", result);
  console.log("Generated result:", result);
}, 60000);

io.on("connection", (socket) => {
  console.log("User connected");
  socket.emit("newResult", generateDiceResult());
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
