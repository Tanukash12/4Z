import pool from "../config/db.js";

class Game {
  static async create(player1Id, player2Id = null, board) {
    const res = await pool.query(
      `INSERT INTO games (player1_id, player2_id, board, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING *`,
      [player1Id, player2Id, board]
    );
    return res.rows[0];
  }

  static async updateBoard(gameId, board, currentTurn) {
    await pool.query(
      `UPDATE games
       SET board = $2, current_turn = $3
       WHERE id = $1`,
      [gameId, board, currentTurn]
    );
  }

  static async finish(gameId, winnerId = null) {
    await pool.query(
      `UPDATE games
       SET status = 'FINISHED',
           winner_id = $2,
           end_time = NOW()
       WHERE id = $1`,
      [gameId, winnerId]
    );
  }

  // (for persistence on game over)
  static async saveResult({ id, player1Id, player2Id, board, winnerId }) {
    await pool.query(
      `INSERT INTO games (id, player1_id, player2_id, board, status, winner_id, end_time)
       VALUES ($1, $2, $3, $4, 'FINISHED', $5, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [id, player1Id, player2Id, board, winnerId]
    );
  }
}

export default Game;
