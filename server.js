const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  path: '/socket.io/'
});

// ✅ СТАТИКА ИЗ КОРНЯ (index.html, текстуры, аудио и т.д.)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// КОМНАТЫ
const rooms = {};  // {roomId: {players: {}, started: false}}

io.on('connection', (socket) => {
  console.log(`Игрок подключился: ${socket.id}`);

  // Вход в лобби
  socket.on('lobbyJoin', (data) => {
    const { roomId, playerName } = data;
    if (!rooms[roomId]) {
      rooms[roomId] = { players: {}, started: false };
    }

    socket.join(roomId);

    rooms[roomId].players[socket.id] = {
      id: socket.id,
      name: playerName || 'Игрок',
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      dir: 'down',
      size: 40,
      score: 0,
      ready: false,
      team: Object.keys(rooms[roomId].players).length % 2 + 1
    };

    // Отправить клиенту:
    socket.emit('id', socket.id);                          // myId
    socket.emit('currentPlayers', Object.values(rooms[roomId].players)); // игроки

    // Отправить всем в комнате:
    io.to(roomId).emit('lobbyUpdate', {
      roomId,
      players: Object.values(rooms[roomId].players),
      started: rooms[roomId].started
    });
  });

  // Готовность (можно не использовать, если не нужна кнопка готов)
  socket.on('toggleReady', (roomId) => {
    if (rooms[roomId]?.players[socket.id]) {
      rooms[roomId].players[socket.id].ready = !rooms[roomId].players[socket.id].ready;
      io.to(roomId).emit('lobbyUpdate', {
        roomId,
        players: Object.values(rooms[roomId].players),
        started: rooms[roomId].started
      });
    }
  });

  // Старт матча
  socket.on('startGame', (roomId) => {
    if (rooms[roomId] && Object.keys(rooms[roomId].players).length >= 2) {
      rooms[roomId].started = true;
      io.to(roomId).emit('gameStart', roomId);
    }
  });

  // Движение игрока
  socket.on('move', (data) => {
    const roomId = Array.from(socket.rooms)[1];
    if (rooms[roomId]?.players[socket.id]) {
      rooms[roomId].players[socket.id] = {
        ...rooms[roomId].players[socket.id],
        x: data.x,
        y: data.y,
        dir: data.dir
      };
      // всем, кроме себя
      socket.to(roomId).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        dir: data.dir
      });
    }
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    console.log(`Игрок отключился: ${socket.id}`);
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        io.to(roomId).emit('lobbyUpdate', {
          roomId,
          players: Object.values(rooms[roomId].players),
          started: rooms[roomId].started
        });
        break;
      }
    }
  });
});

// RENDER PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🌴 Tongan Beach на порту ${port}`);
  console.log(`📱 https://tonganbeach.onrender.com`);
});
