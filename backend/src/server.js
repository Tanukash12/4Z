import 'dotenv/config';
import http from "http";
import app from "./app.js";
import initWebSocket from "./websocket/socketServer.js";
import { initProducer } from "./kafka/producer.js";

const server = http.createServer(app);

// WebSocket lives here
initWebSocket(server);

try {
  await initProducer();
  console.log("Kafka producer initialized");
} catch (err) {
  console.error("Failed to initialize Kafka producer:", err);
}


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});