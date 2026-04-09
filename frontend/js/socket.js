class SocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.eventHandlers = {};
    this.pendingEvents = [];
    this.connectPromise = null;
  }

  connect() {
    if (this.connectPromise) return this.connectPromise;
    
    this.connectPromise = new Promise((resolve, reject) => {
      if (this.isConnected && this.socket) {
        console.log('[Socket] 已连接');
        resolve();
        return;
      }

      try {
        const url = config.serverUrl || 'http://localhost:3000';
        console.log(`[Socket] 正在连接到 ${url} ...`);

        this.socket = io(url, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 15,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 15000,
          forceNew: false,
        });

        let resolved = false;
        let connectionTimeout = null;

        // 设置连接超时
        connectionTimeout = setTimeout(() => {
          if (!resolved) {
            console.error('[Socket] 连接超时');
            this.isConnected = false;
            resolved = true;
            resolve(); // 即使超时也resolve，允许使用本地模式
          }
        }, 20000); // 20秒超时

        this.socket.on('connect', () => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
          console.log(`[Socket] ✅ 连接成功! id=${this.socket.id}`);
          this.isConnected = true;
          this.flushPendingEvents();
          if (!resolved) { resolved = true; resolve(); }
        });

        this.socket.on('connect_error', (error) => {
          console.error(`[Socket] ❌ 连接失败: ${error.message}`);
          this.isConnected = false;
          
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
          if (!resolved) { 
            resolved = true; 
            resolve(); // 即使连接失败也resolve，允许使用本地模式
          }
        });

        this.socket.on('disconnect', (reason) => {
          console.log(`[Socket] 断开连接: ${reason}`);
          this.isConnected = false;
          
          // 根据断开原因决定是否重连
          if (reason === 'io server disconnect') {
            // 服务器主动断开，不自动重连
            console.log('[Socket] 服务器主动断开连接');
          } else {
            // 其他原因，允许自动重连
            console.log('[Socket] 网络中断，将尝试重连');
          }
        });

        this.socket.on('reconnect', (attemptNum) => {
          console.log(`[Socket] 重连成功 (第${attemptNum}次尝试)`);
          this.isConnected = true;
        });

        this.socket.on('reconnect_attempt', (attemptNum) => {
          console.log(`[Socket] 正在尝试重连... (第${attemptNum}次)`);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('[Socket] 重连失败，已达到最大重连次数');
          this.isConnected = false;
        });

        this.socket.on('message', (data) => this.handleEvent('message', data));
        this.socket.on('error', (data) => this.handleEvent('error', data));

      } catch (error) {
        console.error('[Socket] 创建连接异常:', error.message);
        if (!resolved) { resolved = true; resolve(); }
      }
    });

    return this.connectPromise;
  }

  flushPendingEvents() {
    if (!this.socket || this.pendingEvents.length === 0) return;
    console.log(`[Socket] 刷新 ${this.pendingEvents.length} 个待注册事件`);
    const pending = [...this.pendingEvents];
    this.pendingEvents = [];
    pending.forEach(({ event }) => {
      this.socket.on(event, (data) => this.handleEvent(event, data));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      this.connectPromise = null;
    }
  }

  emit(event, data) {
    if (this.isConnected && this.socket) {
      this.socket.emit(event, data);
    } else {
      console.warn(`[Socket] 未连接，无法发送: ${event}`);
    }
  }

  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);

    if (this.socket && this.isConnected) {
      this.socket.on(event, (data) => this.handleEvent(event, data));
    } else {
      if (!this.pendingEvents.some(e => e.event === event)) {
        this.pendingEvents.push({ event });
      }
    }
  }

  off(event, callback) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(cb => cb !== callback);
    }
  }

  handleEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(callback => {
        try { callback(data); } catch (err) {
          console.error(`[Socket] 处理事件[${event}]出错:`, err);
        }
      });
    }
  }

  createRoom(nickname) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.socket) {
        console.warn('[Socket] 未连接，创建房间使用临时ID');
        resolve({ 
          roomId: 'TEMP' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          playerId: 'player_' + Date.now()
        });
        return;
      }
      this.socket.emit('createRoom', { nickname }, (response) => {
        response.success ? resolve({ roomId: response.roomId, playerId: response.playerId }) : reject(response.error);
      });
    });
  }

  joinRoom(roomId, nickname, playerId = null) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.socket) {
        console.warn('[Socket] 未连接，加入房间使用本地模式');
        resolve({
          success: true,
          playerId: 'player_' + Date.now(),
          gameState: {
            roomId, players: [{ id: 'local', playerId: 'player_' + Date.now(), nickname, chips: 1000, seat: 1, isActive: true, isTurn: false }],
            communityCards: [], pots: [{ amount: 0, eligiblePlayers: [] }],
            currentBet: 0, minBet: 0, maxBet: 0, gamePhase: 'WAITING', currentPlayer: null,
          }
        });
        return;
      }
      this.socket.emit('joinRoom', { roomId, nickname, playerId }, (response) => {
        response.success ? resolve(response) : reject(response.error);
      });
    });
  }

  leaveRoom() {
    if (this.socket) this.socket.emit('leaveRoom');
  }

  sendGameAction(action, data) {
    console.log(`[Socket] 发送操作: ${action}`, data);
    if (this.isConnected && this.socket) {
      this.socket.emit('gameAction', { action, data });
    } else {
      console.warn(`[Socket] 未连接，操作未发送: ${action}`);
    }
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }
}

const socketClient = new SocketClient();

try { module.exports = socketClient; } catch (e) { window.socketClient = socketClient; }