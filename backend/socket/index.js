const roomHandler = require('./handlers/room');
const gameHandler = require('./handlers/game');
const omahaGameHandler = require('./handlers/omahaGame');
const unoGameHandler = require('./handlers/unoGame');
const diceGameHandler = require('./handlers/diceGame');
const pokerSimGameHandler = require('./handlers/pokerSimGame');
const gomokuGameHandler = require('./handlers/gomokuGame');
const voiceHandler = require('./handlers/voice');
const { clearRoomPersonality } = require('../utils/aiEngine');
const StandUpGame = require('../utils/standupGame');

const rooms = new Map();

module.exports = function(io) {
  io.on('connection', function(socket) {
    console.log('新用户连接:', socket.id);

    roomHandler(socket, rooms, io);
    gameHandler(socket, rooms, io);
    omahaGameHandler(socket, rooms, io);
    unoGameHandler(socket, rooms, io);
    diceGameHandler(socket, rooms, io);
    pokerSimGameHandler(socket, rooms, io);
    gomokuGameHandler(socket, rooms, io);
    voiceHandler(socket, rooms, io);

    socket.on('disconnect', function() {
      console.log('用户断开连接:', socket.id);

      var playerMap = roomHandler.getSocketToPlayerMap ? roomHandler.getSocketToPlayerMap() : new Map();
      var playerInfo = playerMap.get(socket.id);

      for (var entry of rooms.entries()) {
        var roomId = entry[0];
        var room = entry[1];
        var playerIndex = room.players.findIndex(function(p) { return p.id === socket.id; });
        if (playerIndex !== -1) {
          var player = room.players[playerIndex];
          var playerNickname = player.nickname;

          var suLeaveResult = StandUpGame.onPlayerLeave(room, socket.id);
          if (suLeaveResult) {
            room.players.forEach(function(p) {
              if (p.isAI) return;
              io.to(p.id).emit('gameAction', {
                type: 'standupGame', result: suLeaveResult, timestamp: Date.now(),
              });
            });
          }

          var disconnectTimeout = setTimeout(function() {
            var checkRoom = rooms.get(roomId);
            if (checkRoom) {
              var checkPlayer = checkRoom.players.find(function(p) { return p.id === socket.id; });
              if (checkPlayer) {
                checkPlayer.isOnline = false;
                checkPlayer.lastDisconnectAt = Date.now();

                var updateEvent = 'gameUpdate';
                if (checkRoom.gameType === 'uno') updateEvent = 'unoUpdate';
                else if (checkRoom.gameType === 'omaha') updateEvent = 'omahaUpdate';
                else if (checkRoom.gameType === 'dice') updateEvent = 'diceUpdate';
                else if (checkRoom.gameType === 'poker-sim') updateEvent = 'simUpdate';
                else if (checkRoom.gameType === 'gomoku') updateEvent = 'gomokuUpdate';

                io.to(roomId).emit(updateEvent, {
                  roomId: roomId, players: checkRoom.players,
                  message: playerNickname + ' 暂时离开了',
                });
              }
            }
          }, 3000);

          socket.disconnectTimeout = disconnectTimeout;

          setTimeout(function() {
            var checkRoom = rooms.get(roomId);
            if (checkRoom) {
              var onlinePlayers = checkRoom.players.filter(function(p) { return p.isOnline !== false; });
              if (onlinePlayers.length === 0) {
                if (playerInfo) { playerMap.delete(socket.id); }
                StandUpGame.onTableClose(checkRoom);
                rooms.delete(roomId);
                clearRoomPersonality(roomId);
                console.log('房间 ' + roomId + ' 已删除（所有玩家离线）');
              }
            }
          }, 10000);

          break;
        }
      }

      if (playerInfo) { playerMap.delete(socket.id); }
    });
  });
};

module.exports.rooms = rooms;
