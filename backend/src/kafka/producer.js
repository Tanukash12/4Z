import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "connect-four-backend",
  brokers: ["localhost:9092"],
});

let producer = null; //  IMPORTANT

export async function initProducer() {
  try {
    producer = kafka.producer();
    await producer.connect();
    console.log("Kafka Producer connected");
  } catch (err) {
    console.warn("Kafka disabled (broker not running)");
    producer = null; //  IMPORTANT
  }
}

export async function emitEvent(type, payload) {
  //  SAFETY CHECK
  if (!producer) return;

  try {
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
  } catch (err) {
    console.warn("Kafka emit failed:", err.message);
  }
}
