import { ROWS, COLS } from "../utils/constants.js";

class GameService {
  // Create empty board
  static createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  // Drop disc in a column
  static dropDisc(board, column, playerId) {
    if (column < 0 || column >= COLS) {
      throw new Error("Invalid column");
    }

    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row][column] === null) {
        board[row][column] = playerId;
        return { row, column };
      }
    }

    throw new Error("Column full");
  }

  // Check win
  static checkWin(board, playerId) {
    return (
      this.checkDirection(board, playerId, 0, 1) || // horizontal
      this.checkDirection(board, playerId, 1, 0) || // vertical
      this.checkDirection(board, playerId, 1, 1) || // diagonal \
      this.checkDirection(board, playerId, 1, -1)   // diagonal /
    );
  }

  static checkDirection(board, playerId, rowDir, colDir) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let count = 0;

        for (let i = 0; i < 4; i++) {
          const r = row + i * rowDir;
          const c = col + i * colDir;

          if (
            r >= 0 &&
            r < ROWS &&
            c >= 0 &&
            c < COLS &&
            board[r][c] === playerId
          ) {
            count++;
          } else {
            break;
          }
        }

        if (count === 4) return true;
      }
    }
    return false;
  }

  // Check draw
  static checkDraw(board) {
    return board[0].every((cell) => cell !== null);
  }
}

export default  GameService ;
