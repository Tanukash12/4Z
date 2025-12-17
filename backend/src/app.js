import dotenv from "dotenv";
import express from "express";
import cors from "cors";  
import leaderboardRoutes from "./routes/leaderboard.routes.js";


dotenv.config();

const app = express();

// CORS middleware

app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ]
}));

app.use(express.json());
app.use("/api", leaderboardRoutes);

app.get("/", (req, res) => {
  res.send("Connect Four Backend Running");
});

export default app;
