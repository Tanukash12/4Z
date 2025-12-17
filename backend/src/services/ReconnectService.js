import { RECONNECT_TIMEOUT } from "../utils/constants.js";

class ReconnectService {
  constructor() {
    this.timers = new Map(); // playerId -> timeout
  }

  markDisconnected(playerId, onTimeout) {
    if (this.timers.has(playerId)) return;

    const timer = setTimeout(() => {
      this.timers.delete(playerId);
      onTimeout();
    }, RECONNECT_TIMEOUT);

    this.timers.set(playerId, timer);
  }

  reconnected(playerId) {
    const timer = this.timers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(playerId);
    }
  }
}

export default new ReconnectService();
