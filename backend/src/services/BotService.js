import GameService from "./GameService.js";
import { COLS } from "../utils/constants.js";

class BotService {
  static getMove(game, botId, humanId) {
    // 1. Try winning move
    for (let col = 0; col < COLS; col++) {
      const boardCopy = game.board.map(r => [...r]);
      try {
        GameService.dropDisc(boardCopy, col, botId);
        if (GameService.checkWin(boardCopy, botId)) return col;
      } catch {}
    }

    // 2. Block human win
    for (let col = 0; col < COLS; col++) {
      const boardCopy = game.board.map(r => [...r]);
      try {
        GameService.dropDisc(boardCopy, col, humanId);
        if (GameService.checkWin(boardCopy, humanId)) return col;
      } catch {}
    }

    // 3. Prefer center
    const center = Math.floor(COLS / 2);
    try {
      GameService.dropDisc(game.board.map(r => [...r]), center, botId);
      return center;
    } catch {}

    // 4. Fallback
    for (let col = 0; col < COLS; col++) {
      try {
        GameService.dropDisc(game.board.map(r => [...r]), col, botId);
        return col;
      } catch {}
    }

    return null;
  }
}

export default BotService;
