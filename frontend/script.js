// script.js

/**
 * Connect Four Frontend Application
 * Vanilla JS implementation with WebSocket hooks for backend integration
 */

class ConnectFourGame {
    constructor() {
        this.config = {
            rows: 6,
            columns: 7,
            winningLength: 4,
            animationDuration: 400,
            reconnectInterval: 3000
        };

        this.state = {
            username: '',
            gameId: null,
            playerNumber: null,
            currentPlayer: 1,
            board: [],
            gameActive: false,
            gameOver: false,
            winner: null,
            players: {},
            leaderboard: [],
            socketConnected: false
        };

        this.socket = null;
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.generateBoard();
        this.loadUsername();
        this.initWebSocket();
        this.updateConnectionStatus(false);
        this.renderLeaderboard();
    }

    /**
     * Cache DOM elements for easy access
     */
    cacheElements() {
        // Screens
        this.screens = {
            username: document.getElementById('username-screen'),
            game: document.getElementById('game-screen')
        };

        // Username screen elements
        this.usernameInput = document.getElementById('username-input');
        this.playButton = document.getElementById('play-button');

        // Game screen elements
        this.gameBoard = document.getElementById('game-board');
        this.boardOverlay = document.getElementById('board-overlay');
        this.statusText = document.getElementById('status-text');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.player1Name = document.getElementById('player1-name');
        this.player2Name = document.getElementById('player2-name');
        this.player1Badge = document.getElementById('player1-badge');
        this.player2Badge = document.getElementById('player2-badge');

        // Buttons
        this.backButton = document.getElementById('back-button');
        this.restartButton = document.getElementById('restart-button');
        this.newGameButton = document.getElementById('new-game-button');
        this.refreshLeaderboard = document.getElementById('refresh-leaderboard');

        // Modal elements
        this.resultModal = document.getElementById('result-modal');
        this.resultTitle = document.getElementById('result-title');
        this.resultMessage = document.getElementById('result-message');
        this.resultDisc = document.getElementById('result-disc');
        this.modalNewGame = document.getElementById('modal-new-game');
        this.modalClose = document.getElementById('modal-close');

        // Connection status
        this.connectionStatus = document.getElementById('connection-status');
        this.connectionText = document.getElementById('connection-text');
        this.leaderboardList = document.getElementById('leaderboard-list');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Username screen events
        this.usernameInput.addEventListener('input', this.handleUsernameInput.bind(this));
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.playButton.disabled === false) {
                this.startGame();
            }
        });
        this.playButton.addEventListener('click', this.startGame.bind(this));

        // Game screen events
        this.backButton.addEventListener('click', this.goToUsernameScreen.bind(this));
        this.restartButton.addEventListener('click', this.requestRestart.bind(this));
        this.newGameButton.addEventListener('click', this.requestNewGame.bind(this));
        this.refreshLeaderboard.addEventListener('click', this.refreshLeaderboardData.bind(this));

        // Modal events
        this.modalNewGame.addEventListener('click', this.requestNewGame.bind(this));
        this.modalClose.addEventListener('click', this.hideModal.bind(this));

        // Column indicators for hover effects
        document.querySelectorAll('.column-indicator').forEach(indicator => {
            indicator.addEventListener('click', () => {
                const column = parseInt(indicator.dataset.column);
                this.handleColumnClick(column);
            });

            indicator.addEventListener('mouseenter', () => {
                if (this.state.gameActive && !this.state.gameOver) {
                    this.showColumnHover(parseInt(indicator.dataset.column));
                }
            });

            indicator.addEventListener('mouseleave', () => {
                this.hideColumnHover();
            });
        });

        // Board click event for column selection
        this.gameBoard.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (cell && this.state.gameActive && !this.state.gameOver) {
                const column = parseInt(cell.dataset.column);
                this.handleColumnClick(column);
            }
        });
    }

    /**
     * Generate the 7x6 game board
     */
    generateBoard() {
        this.gameBoard.innerHTML = '';
        this.state.board = Array(this.config.rows).fill().map(() => Array(this.config.columns).fill(0));

        for (let row = 0; row < this.config.rows; row++) {
            for (let col = 0; col < this.config.columns; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.column = col;
                this.gameBoard.appendChild(cell);
            }
        }
    }

    /**
     * Handle username input
     */
    handleUsernameInput() {
        const username = this.usernameInput.value.trim();
        this.playButton.disabled = username.length < 2 || username.length > 20;
        if (username.length >= 2) {
            this.state.username = username;
            localStorage.setItem('connect4_username', username);
        }
    }

    /**
     * Load username from localStorage
     */
    loadUsername() {
        const savedUsername = localStorage.getItem('connect4_username');
        if (savedUsername) {
            this.usernameInput.value = savedUsername;
            this.state.username = savedUsername;
            this.playButton.disabled = false;
        }
    }

    /**
     * Switch to username screen
     */
    goToUsernameScreen() {
        this.screens.username.classList.add('active');
        this.screens.game.classList.remove('active');
        this.disconnectWebSocket();
    }

    /**
     * Start the game (switch to game screen)
     */
    startGame() {
        if (!this.state.username) return;

        this.screens.username.classList.remove('active');
        this.screens.game.classList.add('active');

        // Update player names
        this.player1Name.textContent = this.state.username;
        this.player2Name.textContent = 'Waiting...';

        // Update status
        this.updateStatus('Finding opponent...');
        this.updateTurnIndicator(1);

        // Connect to WebSocket if not already connected
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.initWebSocket();
        }

        // Simulate finding opponent (will be replaced with real WebSocket logic)
        setTimeout(() => {
            this.updateStatus('Your turn!');
            this.state.gameActive = true;
            this.state.gameOver = false;
            this.player2Name.textContent = 'Opponent';
            this.enableBoardInteraction();
        }, 1500);
    }

    /**
     * Handle column click
     * @param {number} column - The column index (0-6)
     */
    handleColumnClick(column) {
        if (!this.state.gameActive || this.state.gameOver) return;
        if (this.state.currentPlayer !== this.state.playerNumber) return;

        // Find the lowest available row in the column
        const row = this.findAvailableRow(column);
        if (row === -1) return;

        // Send move to backend via WebSocket
        this.sendMove(column);

        // Temporarily update UI (will be confirmed by backend)
        this.placeDisc(row, column, this.state.playerNumber);
        this.disableBoardInteraction();
        this.updateStatus('Waiting for opponent...');
    }

    /**
     * Find available row in a column
     * @param {number} column - Column index
     * @returns {number} Row index or -1 if column is full
     */
    findAvailableRow(column) {
        for (let row = this.config.rows - 1; row >= 0; row--) {
            if (this.state.board[row][column] === 0) {
                return row;
            }
        }
        return -1;
    }

    /**
     * Place a disc on the board with animation
     * @param {number} row - Row index
     * @param {number} column - Column index
     * @param {number} player - Player number (1 or 2)
     */
    placeDisc(row, column, player) {
        const cell = this.getCellElement(row, column);
        if (!cell) return;

        // Create disc element
        const disc = document.createElement('div');
        disc.className = `disc player${player}`;
        disc.dataset.player = player;
        
        // Add animation for dropping
        setTimeout(() => {
            disc.classList.add('drop');
        }, 10);

        cell.appendChild(disc);
        
        // Update game state
        this.state.board[row][column] = player;
    }

    /**
     * Get cell DOM element
     * @param {number} row - Row index
     * @param {number} column - Column index
     * @returns {HTMLElement|null} Cell element
     */
    getCellElement(row, column) {
        return document.querySelector(`.cell[data-row="${row}"][data-column="${column}"]`);
    }

    /**
     * Show hover effect for a column
     * @param {number} column - Column index
     */
    showColumnHover(column) {
        const row = this.findAvailableRow(column);
        if (row !== -1) {
            const cell = this.getCellElement(row, column);
            if (cell) {
                const playerClass = `hover-player${this.state.currentPlayer}`;
                cell.classList.add(playerClass);
            }
        }
    }

    /**
     * Hide column hover effects
     */
    hideColumnHover() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('hover-player1', 'hover-player2');
        });
    }

    /**
     * Enable board interaction
     */
    enableBoardInteraction() {
        this.boardOverlay.classList.remove('active');
        this.hideColumnHover();
    }

    /**
     * Disable board interaction
     */
    disableBoardInteraction() {
        this.boardOverlay.classList.add('active');
        this.hideColumnHover();
    }

    /**
     * Update game status text
     * @param {string} text - Status message
     */
    updateStatus(text) {
        this.statusText.textContent = text;
    }

    /**
     * Update turn indicator
     * @param {number} player - Player number (1 or 2)
     */
    updateTurnIndicator(player) {
        this.turnIndicator.className = 'turn-dot';
        this.turnIndicator.classList.add(`active-player${player}`);
        
        // Update player badges
        this.player1Badge.classList.remove('active');
        this.player2Badge.classList.remove('active');
        
        if (player === 1) {
            this.player1Badge.classList.add('active');
        } else {
            this.player2Badge.classList.add('active');
        }
    }

    /**
     * Show win/draw modal
     * @param {string} result - 'win', 'draw', or 'lose'
     * @param {number} winner - Winning player number (if any)
     */
    showResultModal(result, winner = null) {
        if (result === 'win') {
            this.resultTitle.textContent = 'You Win!';
            this.resultMessage.textContent = 'Congratulations! You connected four!';
            this.resultDisc.className = 'result-disc player1-color';
        } else if (result === 'lose') {
            this.resultTitle.textContent = 'You Lose!';
            this.resultMessage.textContent = 'Your opponent connected four. Better luck next time!';
            this.resultDisc.className = 'result-disc player2-color';
        } else {
            this.resultTitle.textContent = 'Game Draw!';
            this.resultMessage.textContent = 'The board is full. It\'s a tie!';
            this.resultDisc.className = 'result-disc';
            this.resultDisc.style.background = 'var(--color-secondary)';
        }

        this.resultModal.classList.add('active');
    }

    /**
     * Hide result modal
     */
    hideModal() {
        this.resultModal.classList.remove('active');
    }

    /**
     * Render leaderboard
     * @param {Array} data - Leaderboard data (optional)
     */
    renderLeaderboard(data = null) {
        if (data) {
            this.state.leaderboard = data;
        }

        if (this.state.leaderboard.length === 0) {
            this.leaderboardList.innerHTML = `
                <div class="leaderboard-placeholder">
                    <p>No games played yet</p>
                    <p class="placeholder-sub">Play to appear on the leaderboard!</p>
                </div>
            `;
            return;
        }

        this.leaderboardList.innerHTML = this.state.leaderboard
            .map((player, index) => `
                <div class="leaderboard-item ${player.name === this.state.username ? 'current-user' : ''}">
                    <div class="player-rank">#${index + 1}</div>
                    <div class="player-info">
                        <div class="player-name">${player.name}</div>
                        <div class="player-stats">${player.wins} wins • ${player.games} games</div>
                    </div>
                    <div class="player-wins">${player.wins}</div>
                </div>
            `)
            .join('');
    }

    /**
     * Update connection status UI
     * @param {boolean} connected - Whether WebSocket is connected
     */
    updateConnectionStatus(connected) {
        this.state.socketConnected = connected;
        this.connectionStatus.className = 'connection-dot';
        this.connectionStatus.classList.add(connected ? 'connected' : 'disconnected');
        this.connectionText.textContent = connected ? 'Connected' : 'Disconnected';
    }

    /**
     * Initialize WebSocket connection (stub for backend integration)
     */
    initWebSocket() {
        // This is a stub for WebSocket integration
        // In a real implementation, this would connect to your backend WebSocket server
        
        console.log('WebSocket: Initializing connection...');
        
        // Simulate connection after a delay
        setTimeout(() => {
            this.updateConnectionStatus(true);
            console.log('WebSocket: Connected (simulated)');
            
            // Simulate receiving player info
            this.state.playerNumber = 1;
            this.state.players = {
                1: { name: this.state.username, wins: 0 },
                2: { name: 'Opponent', wins: 0 }
            };
            
        }, 1000);

        // In a real implementation:
        // this.socket = new WebSocket('ws://your-backend-url');
        // this.socket.onopen = this.handleSocketOpen.bind(this);
        // this.socket.onmessage = this.handleSocketMessage.bind(this);
        // this.socket.onclose = this.handleSocketClose.bind(this);
        // this.socket.onerror = this.handleSocketError.bind(this);
    }

    /**
     * Disconnect WebSocket
     */
    disconnectWebSocket() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.updateConnectionStatus(false);
    }

    /**
     * Handle WebSocket open event
     */
    handleSocketOpen() {
        console.log('WebSocket: Connection established');
        this.updateConnectionStatus(true);
        
        // Send authentication with username
        this.sendWebSocketMessage({
            type: 'auth',
            username: this.state.username
        });
    }

    /**
     * Handle WebSocket message event
     * @param {MessageEvent} event - WebSocket message event
     */
    handleSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.handleGameUpdate(data);
        } catch (error) {
            console.error('WebSocket: Error parsing message', error);
        }
    }

    /**
     * Handle WebSocket close event
     */
    handleSocketClose() {
        console.log('WebSocket: Connection closed');
        this.updateConnectionStatus(false);
        
        // Attempt to reconnect
        if (this.state.username) {
            setTimeout(() => {
                this.initWebSocket();
            }, this.config.reconnectInterval);
        }
    }

    /**
     * Handle WebSocket error event
     * @param {Event} error - WebSocket error event
     */
    handleSocketError(error) {
        console.error('WebSocket: Error occurred', error);
        this.updateConnectionStatus(false);
    }

    /**
     * Send message via WebSocket
     * @param {Object} message - Message to send
     */
    sendWebSocketMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.log('WebSocket: Not connected, message not sent', message);
        }
    }

    /**
     * Send move to backend
     * @param {number} column - Column index
     */
    sendMove(column) {
        console.log(`Sending move to column ${column}`);
        
        // In a real implementation:
        // this.sendWebSocketMessage({
        //     type: 'move',
        //     gameId: this.state.gameId,
        //     column: column
        // });
    }

    /**
     * Handle game update from backend
     * @param {Object} data - Game update data
     */
    handleGameUpdate(data) {
        console.log('Received game update:', data);
        
        // This method would handle various types of game updates:
        // - Game start
        // - Move made
        // - Game over
        // - Player joined/left
        // - Leaderboard updates
        
        switch (data.type) {
            case 'game_start':
                this.handleGameStart(data);
                break;
            case 'move_made':
                this.handleMoveMade(data);
                break;
            case 'game_over':
                this.handleGameOver(data);
                break;
            case 'player_update':
                this.handlePlayerUpdate(data);
                break;
            case 'leaderboard':
                this.handleLeaderboardUpdate(data);
                break;
            default:
                console.warn('Unknown message type:', data.type);
        }
    }

    /**
     * Handle game start message
     * @param {Object} data - Game start data
     */
    handleGameStart(data) {
        this.state.gameId = data.gameId;
        this.state.playerNumber = data.playerNumber;
        this.state.players = data.players;
        this.state.currentPlayer = data.currentPlayer;
        this.state.gameActive = true;
        this.state.gameOver = false;
        
        // Update UI
        this.player1Name.textContent = this.state.players[1]?.name || 'Player 1';
        this.player2Name.textContent = this.state.players[2]?.name || 'Player 2';
        
        if (this.state.currentPlayer === this.state.playerNumber) {
            this.updateStatus('Your turn!');
            this.enableBoardInteraction();
        } else {
            this.updateStatus('Opponent\'s turn');
            this.disableBoardInteraction();
        }
        
        this.updateTurnIndicator(this.state.currentPlayer);
    }

    /**
     * Handle move made message
     * @param {Object} data - Move data
     */
    handleMoveMade(data) {
        const { row, column, player, currentPlayer, board } = data;
        
        // Update board state
        this.state.board = board;
        this.state.currentPlayer = currentPlayer;
        
        // Update UI
        this.placeDisc(row, column, player);
        
        if (this.state.currentPlayer === this.state.playerNumber) {
            this.updateStatus('Your turn!');
            this.enableBoardInteraction();
        } else {
            this.updateStatus('Opponent\'s turn');
            this.disableBoardInteraction();
        }
        
        this.updateTurnIndicator(this.state.currentPlayer);
    }

    /**
     * Handle game over message
     * @param {Object} data - Game over data
     */
    handleGameOver(data) {
        const { winner, winningCells } = data;
        
        this.state.gameActive = false;
        this.state.gameOver = true;
        this.state.winner = winner;
        
        // Highlight winning cells
        if (winningCells) {
            winningCells.forEach(([row, col]) => {
                const cell = this.getCellElement(row, col);
                const disc = cell?.querySelector('.disc');
                if (disc) {
                    disc.classList.add('winning');
                }
            });
        }
        
        // Show result modal
        if (winner === 0) {
            this.showResultModal('draw');
        } else if (winner === this.state.playerNumber) {
            this.showResultModal('win');
        } else {
            this.showResultModal('lose');
        }
        
        this.disableBoardInteraction();
    }

    /**
     * Handle player update message
     * @param {Object} data - Player update data
     */
    handlePlayerUpdate(data) {
        this.state.players = data.players;
        
        // Update player names in UI
        this.player1Name.textContent = this.state.players[1]?.name || 'Player 1';
        this.player2Name.textContent = this.state.players[2]?.name || 'Player 2';
    }

    /**
     * Handle leaderboard update
     * @param {Object} data - Leaderboard data
     */
    handleLeaderboardUpdate(data) {
        this.renderLeaderboard(data.leaderboard);
    }

    /**
     * Request game restart
     */
    requestRestart() {
        if (this.state.gameId) {
            this.sendWebSocketMessage({
                type: 'restart_request',
                gameId: this.state.gameId
            });
        } else {
            // Local restart for demo
            this.resetGame();
            this.state.gameActive = true;
            this.updateStatus('Your turn!');
            this.enableBoardInteraction();
            this.updateTurnIndicator(1);
        }
    }

    /**
     * Request new game
     */
    requestNewGame() {
        this.hideModal();
        
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.sendWebSocketMessage({
                type: 'new_game_request'
            });
        } else {
            // Local new game for demo
            this.resetGame();
            this.state.gameActive = true;
            this.updateStatus('Your turn!');
            this.enableBoardInteraction();
            this.updateTurnIndicator(1);
        }
    }

    /**
     * Reset game state and UI
     */
    resetGame() {
        // Clear board state
        this.state.board = Array(this.config.rows).fill().map(() => Array(this.config.columns).fill(0));
        this.state.currentPlayer = 1;
        this.state.gameOver = false;
        this.state.winner = null;
        
        // Clear UI
        document.querySelectorAll('.disc').forEach(disc => disc.remove());
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('hover-player1', 'hover-player2');
        });
    }

    /**
     * Refresh leaderboard data
     */
    refreshLeaderboardData() {
        // In a real implementation, this would request fresh leaderboard data
        console.log('Refreshing leaderboard...');
        
        // Simulate leaderboard data for demo
        const demoLeaderboard = [
            { name: this.state.username, wins: 3, games: 5 },
            { name: 'Player2', wins: 2, games: 4 },
            { name: 'Player3', wins: 1, games: 3 },
            { name: 'Player4', wins: 1, games: 2 },
            { name: 'Player5', wins: 0, games: 1 }
        ];
        
        this.renderLeaderboard(demoLeaderboard);
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ConnectFourGame();
});