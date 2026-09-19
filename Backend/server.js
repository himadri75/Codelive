require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const url = require("url");

// Controllers
const {
  joinRoomController,
  leaveRoomController,
  handleUserDisconnect,
  getAllUsersController,
} = require("./controllers/roomConroller");
const { handleMsgFromClient } = require("./controllers/chatMessageController");
const { createRoomAPI } = require("./controllers/restapi/createRoomAPI");

// Yjs
const WebSocket = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");
const generateCode = require("./controllers/restapi/generateCode");
const { connectRedis, redisClient } = require("./config/redis");

const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);

// Express & CORS setup
const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN_1,
  process.env.ALLOWED_ORIGIN_2,
  process.env.ALLOWED_ORIGIN_3,
].filter(Boolean);

app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  }),
);

app.get("/healthz", async (req, res) => {
  try {
    await redisClient.set("healthz", "ok");

    return res.status(200).json({
      status: "ok",
      server: "Server is UP",
      redis: "ok",
    });
  } catch (error) {
    return res.status(503).json({
      status: "error",
      server: "Server is UP",
      redis: "error",
    });
  }
});

// REST Endpoints
app.post("/api/create-room", createRoomAPI);
app.post("/api/ai/generate", generateCode);

// Socket.IO for chat & rooms
const io = socketIo(server, {
  path: "/socket.io",
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  allowEIO3: true,
});

io.on("connection", (socket) => {
  console.log(`✅ Socket.IO: User connected with ID: ${socket.id}`);

  socket.on("messageFromClient", () => {
    socket.emit("validateConnection", "Server is connected.");
  });

  socket.on("joinRoom", ({ name, roomCode }) =>
    joinRoomController(io, socket, name, roomCode),
  );
  socket.on("getAllUser", (roomCode) =>
    getAllUsersController(io, socket, roomCode),
  );
  socket.on("msgFromClient", ({ roomCode, name, msg }) =>
    handleMsgFromClient(socket, { roomCode, name, msg }),
  );
  socket.on("leaveRoom", ({ name, roomCode }) =>
    leaveRoomController(io, socket, name, roomCode),
  );
  socket.on("disconnect", () => handleUserDisconnect(io, socket));
});

// Yjs WebSocket on same port (path-based upgrade)
const wss = new WebSocket.Server({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  if (pathname.startsWith("/yjs")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const query = url.parse(request.url, true).query;
      const roomCode = query.room || "default-doc";
      setupWSConnection(ws, request, { docName: roomCode });
      console.log(`✅ Yjs: Client connected to document: ${roomCode}`);
    });
  } else {
    socket.destroy(); // reject connections to unknown paths
  }
});

// Start server
async function startServer() {
  try {
    await connectRedis();
    console.log("✅ Redis connected");

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`   - Socket.IO path: /socket.io`);
      console.log(`   - Yjs WebSocket path: /yjs`);
      console.log(`   - REST API available at /api`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
