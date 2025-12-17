import { WebSocketServer } from "ws";
import MatchmakingService from "../services/MatchmakingService.js";
import GameService from "../services/GameService.js";
import BotService from "../services/BotService.js";


/**
 * In-memory stores
 */
const activeGames = new Map();        // gameId -> game
const socketMeta = new Map();         // ws -> { gameId, playerId }

/**
 * Safe send helper
 */
const send = (ws, data) => {
  if (ws?.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
};


/**
 * WebSocket init
 */
export default function initWebSocket(server) {
  const wss = new WebSocketServer({ server });
  const matchmaking = new MatchmakingService(send);

  wss.on("connection", (ws) => {
    console.log("WebSocket connected");

    ws.on("message", (msg) => {
      const data = JSON.parse(msg);

      // ---------------- JOIN GAME ----------------
      if (data.type === "join_game") {
        const game = matchmaking.join(ws, data.username);

        if (!game) return; // waiting state

        activeGames.set(game.id, game);

        game.players.forEach((p) => {
          if (p.ws) {
            socketMeta.set(p.ws, {
              gameId: game.id,
              playerId: p.id,
            });

            send(p.ws, {
              type: "game_start",
              gameId: game.id,
              opponent: game.players.find(x => x.id !== p.id).username,
              yourTurn: p.id === game.currentTurn,
            });
          }
        });
      }

      // ---------------- MAKE MOVE ----------------
      if (data.type === "make_move") {
        const meta = socketMeta.get(ws);
        if (!meta) return;

        const game = activeGames.get(meta.gameId);
        if (!game || game.status !== "ACTIVE") return;

        if (game.currentTurn !== meta.playerId) {
          return send(ws, { type: "error", message: "Not your turn" });
        }

        // -------- HUMAN MOVE --------
        try {
          GameService.dropDisc(game.board, data.column, meta.playerId);

          // Human win
          if (GameService.checkWin(game.board, meta.playerId)) {
            game.status = "FINISHED";

            game.players.forEach(p =>
              p.ws && send(p.ws, {
                type: "game_over",
                winner: meta.playerId,
                board: game.board,
              })
            );
            return;
          }

          // Draw
          if (GameService.checkDraw(game.board)) {
            game.status = "FINISHED";

            game.players.forEach(p =>
              p.ws && send(p.ws, {
                type: "game_over",
                winner: null,
                board: game.board,
              })
            );
            return;
          }

          // Switch turn
          const nextPlayer = game.players.find(p => p.id !== meta.playerId);
          game.currentTurn = nextPlayer.id;

          // Broadcast human move
          game.players.forEach(p =>
            p.ws && send(p.ws, {
              type: "game_update",
              board: game.board,
              currentTurn: game.currentTurn,
            })
          );

          // -------- BOT MOVE (if applicable) --------
          if (nextPlayer.isBot) {
            const botColumn = BotService.getMove(
              game,
              nextPlayer.id,
              meta.playerId
            );

            if (botColumn !== null) {
              GameService.dropDisc(game.board, botColumn, nextPlayer.id);

              // Bot win
              if (GameService.checkWin(game.board, nextPlayer.id)) {
                game.status = "FINISHED";

                game.players.forEach(p =>
                  p.ws && send(p.ws, {
                    type: "game_over",
                    winner: nextPlayer.id,
                    board: game.board,
                  })
                );
                return;
              }

              // Switch back to human
              game.currentTurn = meta.playerId;

              // Broadcast bot move
              game.players.forEach(p =>
                p.ws && send(p.ws, {
                  type: "game_update",
                  board: game.board,
                  currentTurn: game.currentTurn,
                })
              );
            }
          }

        } catch (err) {
          send(ws, { type: "error", message: err.message });
        }
      }
    });

    // ---------------- DISCONNECT ----------------
    ws.on("close", () => {
      const meta = socketMeta.get(ws);
      if (!meta) return;

      const game = activeGames.get(meta.gameId);
      if (!game) return;

      game.players.forEach(p => {
        if (p.ws && p.ws !== ws) {
          send(p.ws, {
            type: "opponent_disconnected",
            message: "Opponent disconnected",
          });
        }
      });

      socketMeta.delete(ws);
    });
  });
}
