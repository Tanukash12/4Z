import dotenv from "dotenv";
import express from "express";
import leaderboardRoutes from "./routes/leaderboard.routes.js";


dotenv.config();

const app = express();

app.use(express.json());
app.use("/api", leaderboardRoutes);

app.get("/", (req, res) => {
  res.send("Connect Four Backend Running");
});

export default app;
