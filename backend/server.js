const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
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
});