import { GameState } from "./game.js";
import { sendMove } from "./socket.js";

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");

export function renderBoard() {
  boardEl.innerHTML = "";

  // UI enable/disable based on turn
  boardEl.style.pointerEvents = GameState.isMyTurn ? "auto" : "none";

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const value = GameState.board[row][col];
      if (value) {
        cell.classList.add(
          value === GameState.playerId ? "me" : "opponent"
        );
      }

      // ✅ ONLY TOP ROW HANDLES CLICK → column based move
      if (row === 0) {
        cell.onclick = () => {
          if (!GameState.isMyTurn) return;

          console.log("Sending move for column:", col);
          sendMove(col);
        };
      }

      boardEl.appendChild(cell);
    }
  }
}




export function showStatus(message) {
  statusEl.innerText = message;
}

export function showGameOver(winnerId, reason) {
  if (!winnerId) {
    showStatus("Game Draw!");
  } else if (winnerId == GameState.playerId) {
    showStatus("You Win 🎉");
  } else {
    showStatus("You Lose 😢");
  }

  if (reason === "forfeit") {
    showStatus("Opponent forfeited. You win!");
  }
}
