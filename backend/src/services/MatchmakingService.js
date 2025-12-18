import GameService from "./GameService.js";
import BotService from "./BotService.js";
import Player from "../models/Player.js";
import { MATCH_TIMEOUT, BOT } from "../utils/constants.js";
import { v4 as uuidv4 } from "uuid";

class MatchmakingService {
  constructor(send) {
    this.waitingPlayer = null;
    this.timeout = null;
    this.send = send;
  }

  async join(ws, username) {
    // 🔴 ENSURE PLAYER EXISTS IN DB
    const dbPlayer = await Player.findOrCreate(username, "HUMAN");

    const player = {
      id: dbPlayer.id,      // ✅ DB ID
      username: dbPlayer.username,
      ws,
      isBot: false,
    };

    if (!this.waitingPlayer) {
      this.waitingPlayer = player;

      this.timeout = setTimeout(() => {
        this.startBotGame(player);
      }, MATCH_TIMEOUT);

      this.send(ws, { type: "waiting" });
      return null;
    }

    clearTimeout(this.timeout);

    const game = this.createGame(this.waitingPlayer, player);
    this.waitingPlayer = null;

    return game;
  }

  createGame(p1, p2) {
    return {
      id: uuidv4(), // game id is fine
      players: [p1, p2],
      board: GameService.createBoard(),
      currentTurn: p1.id,
      status: "ACTIVE",
    };
  }

  async startBotGame(player) {
    // 🔴 ENSURE BOT EXISTS IN DB
    const botDb = await Player.findOrCreate(BOT.NAME, "BOT");

    const bot = {
      id: botDb.id,      // ✅ DB ID
      username: BOT.NAME,
      isBot: true,
    };

    const game = this.createGame(player, bot);

    this.send(player.ws, {
      type: "game_start",
      gameId: game.id,
      opponent: BOT.NAME,
      yourTurn: true,
    });
  }
}

export default MatchmakingService;
