import pool from "../config/db.js";

class Player {
  static async findByUsername(username) {
    const res = await pool.query(
      `SELECT * FROM players WHERE username = $1`,
      [username]
    );
    return res.rows[0];
  }

  static async create(username, type = "HUMAN") {
    const res = await pool.query(
      `INSERT INTO players (username, type)
       VALUES ($1, $2)
       RETURNING *`,
      [username, type]
    );
    return res.rows[0];
  }

  static async findOrCreate(username, type = "HUMAN") {
    let player = await this.findByUsername(username);
    if (!player) {
      player = await this.create(username, type);
    }
    return player;
  }

  static async incrementWin(playerId) {
    await pool.query(
      `UPDATE players SET wins = wins + 1 WHERE id = $1`,
      [playerId]
    );
  }

  static async leaderboard(limit = 10) {
    const res = await pool.query(
      `SELECT username, wins
       FROM players
       ORDER BY wins DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}

export default Player;
