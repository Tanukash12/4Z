import { Kafka } from "kafkajs";
import { metrics } from "./metrics.js";

const kafka = new Kafka({
  clientId: "connect-four-analytics",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "analytics-group" });

await consumer.connect();
await consumer.subscribe({ topic: "game-events" });

console.log("📊 Analytics consumer running...");

await consumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());
    handleEvent(event);
  },
});

function handleEvent(event) {
  const { type, payload } = event;

  switch (type) {
    case "GAME_STARTED":
      metrics.gamesStarted++;
      break;

    case "MOVE_PLAYED":
      metrics.moves++;
      break;

    case "GAME_FINISHED":
      metrics.gamesFinished++;
      if (payload.winnerId) {
        metrics.wins[payload.winnerId] =
          (metrics.wins[payload.winnerId] || 0) + 1;
      }
      break;
  }

  console.clear();
  console.log("📈 LIVE METRICS");
  console.table(metrics);
}
