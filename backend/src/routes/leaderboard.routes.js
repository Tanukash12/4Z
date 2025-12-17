import express from "express";
import { getLeaderboard } from "../controllers/Leaderboard.Controller.js";

const router = express.Router();

router.get("/leaderboard", getLeaderboard);

export default router;
