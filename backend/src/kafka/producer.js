import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "connect-four-backend",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

export async function initProducer() {
  await producer.connect();
  console.log("Kafka Producer connected");
}

export async function emitEvent(type, payload) {
  await producer.send({
    topic: "game-events",
    messages: [
      {
        key: type,
        value: JSON.stringify({
          type,
          payload,
          timestamp: Date.now(),
        }),
      },
    ],
  });
}
