import GameService from "./GameService.js";
import { COLS, ROWS } from "../utils/constants.js";

class BotService {
  static getMove(game, botId, humanId) {
    // 1️⃣ Win if possible
    for (let col = 0; col < COLS; col++) {
      if (this.simulate(game.board, col, botId)) {
        return col;
      }
    }

    // 2️⃣ Block human win
    for (let col = 0; col < COLS; col++) {
      if (this.simulate(game.board, col, humanId)) {
        return col;
      }
    }

    // 3️⃣ Prefer center
    const order = [3, 2, 4, 1, 5, 0, 6];
    for (let col of order) {
      if (this.isValidMove(game.board, col)) {
        return col;
      }
    }

    return null;
  }

  static simulate(board, col, playerId) {
    const copy = board.map(r => [...r]);
    for (let row = ROWS - 1; row >= 0; row--) {
      if (copy[row][col] === null) {
        copy[row][col] = playerId;
        return GameService.checkWin(copy, playerId);
      }
    }
    return false;
  }

  static isValidMove(board, col) {
    return board[0][col] === null;
  }
}

export default BotService;
