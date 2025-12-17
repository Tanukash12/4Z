import { WebSocketServer } from "ws";

import MatchmakingService from "../services/MatchmakingService.js";
import GameService from "../services/GameService.js";
import BotService from "../services/BotService.js";
import ReconnectService from "../services/ReconnectService.js";

import Game from "../models/Game.js";
import Player from "../models/Player.js";

/**
 * In-memory stores
 */
const activeGames = new Map();   // gameId -> game
const socketMeta = new Map();    // ws -> { gameId, playerId }

/**
 * Safe send
 */
const send = (ws, data) => {
  if (ws && ws.readyState === ws.OPEN) {
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

    // ⚠️ MUST be async now
    ws.on("message", async (msg) => {
      const data = JSON.parse(msg);

      /* ================= JOIN GAME ================= */
      if (data.type === "join_game") {
        const game = matchmaking.join(ws, data.username);
        if (!game) return;

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

      /* ================= MAKE MOVE ================= */
      if (data.type === "make_move") {
        const meta = socketMeta.get(ws);
        if (!meta) return;

        const game = activeGames.get(meta.gameId);
        if (!game || game.status !== "ACTIVE") return;

        if (game.currentTurn !== meta.playerId) {
          return send(ws, { type: "error", message: "Not your turn" });
        }

        /* ---------- HUMAN MOVE ---------- */
        try {
          GameService.dropDisc(game.board, data.column, meta.playerId);

          /* 🏆 HUMAN WIN */
          if (GameService.checkWin(game.board, meta.playerId)) {
            game.status = "FINISHED";

            await Game.saveResult({
              id: game.id,
              player1Id: game.players[0].id,
              player2Id: game.players[1].id,
              board: game.board,
              winnerId: meta.playerId,
            });

            await Player.incrementWin(meta.playerId);

            game.players.forEach(p =>
              p.ws && send(p.ws, {
                type: "game_over",
                winner: meta.playerId,
                board: game.board,
              })
            );

            activeGames.delete(game.id);
            return;
          }

          /* 🤝 DRAW */
          if (GameService.checkDraw(game.board)) {
            game.status = "FINISHED";

            await Game.saveResult({
              id: game.id,
              player1Id: game.players[0].id,
              player2Id: game.players[1].id,
              board: game.board,
              winnerId: null,
            });

            game.players.forEach(p =>
              p.ws && send(p.ws, {
                type: "game_over",
                winner: null,
                board: game.board,
              })
            );

            activeGames.delete(game.id);
            return;
          }

          /* SWITCH TURN */
          const nextPlayer = game.players.find(p => p.id !== meta.playerId);
          game.currentTurn = nextPlayer.id;

          game.players.forEach(p =>
            p.ws && send(p.ws, {
              type: "game_update",
              board: game.board,
              currentTurn: game.currentTurn,
            })
          );

          /* ---------- BOT MOVE ---------- */
          if (nextPlayer.isBot) {
            const botCol = BotService.getMove(
              game,
              nextPlayer.id,
              meta.playerId
            );

            if (botCol !== null) {
              GameService.dropDisc(game.board, botCol, nextPlayer.id);

              /* 🤖 BOT WIN */
              if (GameService.checkWin(game.board, nextPlayer.id)) {
                game.status = "FINISHED";

                await Game.saveResult({
                  id: game.id,
                  player1Id: game.players[0].id,
                  player2Id: game.players[1].id,
                  board: game.board,
                  winnerId: nextPlayer.id,
                });

                await Player.incrementWin(nextPlayer.id);

                game.players.forEach(p =>
                  p.ws && send(p.ws, {
                    type: "game_over",
                    winner: nextPlayer.id,
                    board: game.board,
                  })
                );

                activeGames.delete(game.id);
                return;
              }

              game.currentTurn = meta.playerId;

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

      /* ================= RECONNECT ================= */
      if (data.type === "reconnect") {
        const { gameId, playerId } = data;
        const game = activeGames.get(gameId);
        if (!game) return;

        const player = game.players.find(p => p.id === playerId);
        if (!player) return;

        player.ws = ws;
        player.disconnected = false;

        socketMeta.set(ws, { gameId, playerId });
        ReconnectService.reconnected(playerId);

        send(ws, {
          type: "reconnected",
          board: game.board,
          currentTurn: game.currentTurn,
        });

        game.players.forEach(p => {
          if (p.ws && p.id !== playerId) {
            send(p.ws, { type: "opponent_reconnected" });
          }
        });
      }
    });

    /* ================= DISCONNECT ================= */
    ws.on("close", async () => {
      const meta = socketMeta.get(ws);
      if (!meta) return;

      const game = activeGames.get(meta.gameId);
      if (!game) return;

      const player = game.players.find(p => p.id === meta.playerId);
      if (!player) return;

      player.disconnected = true;

      ReconnectService.markDisconnected(player.id, async () => {
        game.status = "FINISHED";
        const winner = game.players.find(p => p.id !== player.id);

        await Game.saveResult({
          id: game.id,
          player1Id: game.players[0].id,
          player2Id: game.players[1].id,
          board: game.board,
          winnerId: winner?.id ?? null,
        });

        if (winner?.id) {
          await Player.incrementWin(winner.id);
        }

        game.players.forEach(p =>
          p.ws && send(p.ws, {
            type: "game_over",
            winner: winner?.id ?? null,
            reason: "forfeit",
          })
        );

        activeGames.delete(game.id);
      });

      game.players.forEach(p => {
        if (p.ws && p.id !== player.id) {
          send(p.ws, {
            type: "opponent_disconnected",
            message: "Opponent disconnected. Waiting 30s…",
          });
        }
      });

      socketMeta.delete(ws);
    });
  });
}
