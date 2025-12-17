import 'dotenv/config';
import http from "http";
import app from "./app.js";
import initWebSocket from "./websocket/socketServer.js";

const server = http.createServer(app);

// WebSocket lives here
initWebSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});