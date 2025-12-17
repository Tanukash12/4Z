import Player from "../models/Player.js";

export const getLeaderboard = async (req, res) => {
  const data = await Player.leaderboard();
  res.json({
    success: true,
    data,
  });
};
