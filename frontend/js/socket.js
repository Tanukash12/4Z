import { GameState } from "./game.js";
import { renderBoard, showStatus, showGameOver } from "./ui.js";

export function connectSocket(username) {
  const ws = new WebSocket("ws://127.0.0.1:5000");
  GameState.socket = ws;
  GameState.username = username;

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: "join_game",
      username,
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleSocketEvent(data);
  };

  ws.onclose = () => {
    showStatus("Disconnected from server");
  };
}

function handleSocketEvent(data) {
  switch (data.type) {
    case "waiting":
      showStatus("Waiting for opponent...");
      break;

    case "game_start":
      GameState.gameId = data.gameId;
      GameState.playerId = data.playerId;
      GameState.opponent = data.opponent;
      GameState.isMyTurn = data.yourTurn;
      GameState.board = Array.from({ length: 6 }, () => Array(7).fill(null));
      showStatus(
          `You (${GameState.username}) vs ${data.opponent} — ${
            data.yourTurn ? "Your turn" : "Opponent's turn"
          }`
        );
      renderBoard();
      break;

    case "game_update":
      GameState.board = data.board;
      GameState.currentTurn = data.currentTurn;
      GameState.isMyTurn = data.currentTurn === GameState.playerId;
      renderBoard();
      break;

    case "game_over":
      console.log("Game Over received:", data);
      GameState.board = data.board || GameState.board;
      GameState.isMyTurn = false; 
      renderBoard();
      showGameOver(data.winner, data.reason);
      document.getElementById("board").style.pointerEvents = "none";
      break;

    case "opponent_disconnected":
      showStatus(data.message);
      break;

    case "opponent_reconnected":
      showStatus("Opponent reconnected");
      break;

    case "reconnected":
      GameState.board = data.board;
      GameState.currentTurn = data.currentTurn;
      renderBoard();
      showStatus("Reconnected successfully");
      break;

    case "error":
      showStatus(data.message);
      break;
  }
}

export function sendMove(column) {
  if (!GameState.socket || !GameState.isMyTurn) return;

  GameState.socket.send(JSON.stringify({
    type: "make_move",
    column,
  }));
}
