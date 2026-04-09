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
        const url = config.serverUrl;
        console.log(`[Socket] 正在连接到 ${url} ...`);

        this.socket = io(url, {
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 30000,
          forceNew: false,
          upgrade: true,
        });

        let resolved = false;
        let connectionTimeout = null;

        connectionTimeout = setTimeout(() => {
          if (!resolved) {
            console.error('[Socket] 连接超时(30s)');
            this.isConnected = false;
            resolved = true;
            reject(new Error('连接服务器超时，请检查网络后刷新页面重试'));
          }
        }, 35000);

        this.socket.on('connect', () => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
          console.log(`[Socket] 连接成功! id=${this.socket.id}`);
          this.isConnected = true;
          this.flushPendingEvents();
          if (!resolved) { resolved = true; resolve(); }
        });

        this.socket.on('connect_error', (error) => {
          console.error(`[Socket] 连接失败: ${error.message}`);
          this.isConnected = false;
        });

        this.socket.on('disconnect', (reason) => {
          console.log(`[Socket] 断开连接: ${reason}`);
          this.isConnected = false;
          
          if (reason === 'io server disconnect') {
            console.log('[Socket] 服务器主动断开连接');
          } else {
            console.log('[Socket] 网络中断，将尝试重连');
          }
        });

        this.socket.on('reconnect', (attemptNum) => {
          console.log(`[Socket] 重连成功 (第${attemptNum}次尝试)`);
          this.isConnected = true;
          this.flushPendingEvents();
        });

        this.socket.on('reconnect_attempt', (attemptNum) => {
          console.log(`[Socket] 正在尝试重连... (第${attemptNum}次)`);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('[Socket] 重连失败，已达到最大重连次数');
          this.isConnected = false;
        });

      } catch (error) {
        console.error('[Socket] 创建连接异常:', error.message);
        if (!resolved) { resolved = true; reject(error); }
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
        reject(new Error('未连接到服务器'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('创建房间超时，服务器未响应'));
      }, 15000);

      this.socket.emit('createRoom', { nickname }, (response) => {
        clearTimeout(timeout);
        if (response && response.success) {
          resolve({ roomId: response.roomId, playerId: response.playerId });
        } else {
          reject(new Error((response && response.error) || '创建房间失败'));
        }
      });
    });
  }

  joinRoom(roomId, nickname, playerId = null) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('加入房间超时，服务器未响应'));
      }, 15000);

      this.socket.emit('joinRoom', { roomId, nickname, playerId }, (response) => {
        clearTimeout(timeout);
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error((response && response.error) || '加入房间失败'));
        }
      });
    });
  }

  leaveRoom() {
    if (this.socket) this.socket.emit('leaveRoom');
  }

  sendGameAction(action, data) {
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