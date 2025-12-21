import { WebSocketServer } from "ws";

import MatchmakingService from "../services/MatchmakingService.js";
import GameService from "../services/GameService.js";
import BotService from "../services/BotService.js";
import ReconnectService from "../services/ReconnectService.js";
import { emitEvent } from "../kafka/producer.js";

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
  const matchmaking = new MatchmakingService(send, (game) => {
    activeGames.set(game.id, game);

    game.players.forEach((p) => {
      if (p.ws) {
        socketMeta.set(p.ws, {
          gameId: game.id,
          playerId: p.id,
        });
      }
    });
  });

  wss.on("connection", (ws) => {
    console.log("WebSocket connected");

    // ⚠️ MUST be async now
    ws.on("message", async (msg) => {
      const data = JSON.parse(msg);

      /* ================= JOIN GAME ================= */
      if (data.type === "join_game") {
        const game = await matchmaking.join(ws, data.username);
        if (!game) return;

        activeGames.set(game.id, game);

        try {
           await emitEvent("GAME_STARTED", {
          gameId: game.id,
          players: game.players.map(p => p.id),
        });
        } catch (e) {
          console.error("Kafka error:", e.message);
        }
       


        game.players.forEach((p) => {
          if (p.ws) {
            socketMeta.set(p.ws, {
              gameId: game.id,
              playerId: p.id,
            });

            send(p.ws, {
              type: "game_start",
              gameId: game.id,
              playerId: p.id, 
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



  // Turn verification
  if (game.currentTurn !== meta.playerId) {
    return send(ws, { type: "error", message: "Not your turn" });
  }

  try {
    /* ---------- 1. PROCESS HUMAN MOVE ---------- */
    GameService.dropDisc(game.board, data.column, meta.playerId);

    
    
    // Kafka Analytics for move
    try {
      await emitEvent("MOVE_PLAYED", { gameId: game.id, playerId: meta.playerId, column: data.column });
    } catch (e) { console.error("Kafka error:", e.message); }

    /* 🏆 CHECK HUMAN WIN */
    if (GameService.checkWin(game.board, meta.playerId)) {
      return await finishGame(game, meta.playerId, "win");
    }

    /* 🤝 CHECK HUMAN DRAW */
    if (GameService.checkDraw(game.board)) {
      return await finishGame(game, null, "draw");
    }

    /* ---------- 2. HANDLE NEXT PLAYER / BOT ---------- */
    const nextPlayer = game.players.find(p => p.id !== meta.playerId);

    if (nextPlayer.isBot) {

      if (game.botThinking) return;
game.botThinking = true;


      game.currentTurn = nextPlayer.id;
      
      // Notify UI that it is now the Bot's turn
      game.players.forEach(p =>
        p.ws && send(p.ws, { type: "game_update", board: game.board, currentTurn: game.currentTurn,  canMove: p.id === game.currentTurn, })
      );

      const botCol = BotService.getMove(game, nextPlayer.id, meta.playerId);
      if (botCol === null) return;

      

      // Simulate Bot "Thinking"
        setTimeout(async () => {
    try {
      if (!activeGames.has(game.id)) return;
      if (game.status !== "ACTIVE") return;

      GameService.dropDisc(game.board, botCol, nextPlayer.id);

      // 🔥 SEND UPDATE AFTER BOT MOVE
      game.players.forEach(p =>
        p.ws && send(p.ws, {
          type: "game_update",
          board: game.board,
          currentTurn: nextPlayer.id,
          canMove: false, 
        })
      );

      if (GameService.checkWin(game.board, nextPlayer.id)) {
        return await finishGame(game, nextPlayer.id, "win");
      }

      if (GameService.checkDraw(game.board)) {
        return await finishGame(game, null, "draw");
      }

      const human = game.players.find(p => !p.isBot);
      game.currentTurn = human.id;

      game.players.forEach(p =>
        p.ws && send(p.ws, {
          type: "game_update",
          board: game.board,
          currentTurn: game.currentTurn,
          canMove: p.id === game.currentTurn,
        })
      );

    } finally {
      // ✅ ALWAYS RESET FLAG
      game.botThinking = false;
    }
  }, 1000);


      return; // Exit human block; bot logic continues in timeout
    }

    /* ---------- 3. HUMAN VS HUMAN TURN SWITCH ---------- */
    game.currentTurn = nextPlayer.id;
    game.players.forEach(p =>
      p.ws && send(p.ws, {
        type: "game_update",
        board: game.board,
        currentTurn: game.currentTurn,
        canMove: p.id === game.currentTurn,
      })
    );

  } catch (err) {
    send(ws, { type: "error", message: err.message });
  }
}

/**
 * HELPER FUNCTION: Handle DB saves, Kafka alerts, and Socket notifications
 * Paste this OUTSIDE of the initWebSocket function (at the bottom of your file)
 */
async function finishGame(game, winnerId, reason) {
  if(game.status === "FINISHED") return ;

  game.status = "FINISHED";
  
  // Save result to DB
  await Game.saveResult({
    id: game.id,
    player1Id: game.players[0].id,
    player2Id: game.players[1].id,
    board: game.board,
    winnerId: winnerId,
  });

  if (winnerId) await Player.incrementWin(winnerId);

  // Kafka Analytics
  try {
    await emitEvent("GAME_FINISHED", { gameId: game.id, winnerId, reason });
  } catch (e) { console.error("Kafka error:", e.message); }

  // 2. Notify BOTH players with the FINAL board
  game.players.forEach(p => {
    if (p.ws) {
      send(p.ws, {
        type: "game_over",
        winner: winnerId,
        board: game.board, // VERY IMPORTANT: Send the board here
        reason: reason
      });
    }
  });

  activeGames.delete(game.id);
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

        try {
          await emitEvent("GAME_FINISHED", {
          gameId: game.id,
          winnerId: winner?.id ?? null,
          reason: "forfeit",
        });
        } catch (e) {
          console.error("Kafka error:", e.message);
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
