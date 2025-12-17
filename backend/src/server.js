import "dotenv/config";
import http from "http";
import app from "./app.js";
import initWebSocket from "./websocket/socketServer.js";

const server = http.createServer(app);

// WebSocket lives here
initWebSocket(server);

server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
