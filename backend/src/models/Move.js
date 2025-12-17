import pool from "../config/db.js";

class Move {
  static async create(gameId, playerId, column, row) {
    await pool.query(
      `INSERT INTO moves (game_id, player_id, column_index, row_index)
       VALUES ($1, $2, $3, $4)`,
      [gameId, playerId, column, row]
    );
  }
}

export default { Move };
