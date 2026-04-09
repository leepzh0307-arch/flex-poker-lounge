const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const path = require('path');
const { Server } = require('socket.io');

// 加载环境变量
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

const socketHandler = require('./socket/index');
socketHandler(io);

// 声网Token生成路由
const agoraRoutes = require('./routes/agora');
app.use('/api/agora', agoraRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
app.get('/room.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'room.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`前端页面: http://localhost:${PORT}/`);
  console.log(`房间页面: http://localhost:${PORT}/room.html`);

  if (process.env.NODE_ENV === 'production') {
    const keepAlive = setInterval(() => {
      https.get(`https://flex-poker-backend.onrender.com/health`, (res) => {
        console.log('[保活] ping 成功, status:', res.statusCode);
      }).on('error', (err) => {
        console.error('[保活] ping 失败:', err.message);
      });
    }, 10 * 60 * 1000);
    console.log('[保活] 已启用，每 10 分钟自动 ping');
  }
});