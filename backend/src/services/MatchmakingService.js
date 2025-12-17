import { v4 as uuidv4 } from "uuid";
import GameService from "./GameService.js";
import BotService from "./BotService.js";
import { MATCH_TIMEOUT, BOT } from "../utils/constants.js";

class MatchmakingService {
  constructor(send) {
    this.waitingPlayer = null;
    this.timeout = null;
    this.send = send;
  }

  join(ws, username) {
    const player = { id: uuidv4(), username, ws };

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
      id: uuidv4(),
      players: [p1, p2],
      board: GameService.createBoard(),
      currentTurn: p1.id,
      status: "ACTIVE",
    };
  }

  startBotGame(player) {
    const bot = { id: uuidv4(), username: BOT.NAME, isBot: true };

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
