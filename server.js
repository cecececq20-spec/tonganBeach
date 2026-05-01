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

// ✅ СТАТИКА ИЗ КОРНЯ (index.html, textures, items, ost и т.д.)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// КОМНАТЫ
const rooms = {};  // {roomId: {players: {}, started: false}}

io.on('connection', (socket) => {
  console.log(`⚽ Игрок подключился: ${socket.id}`);

  // 1) отправляем клиенту доступные комнаты
  socket.emit('availableRooms',
    Object.keys(rooms).filter(id => !rooms[id].started)
  );

  // 2) вход в лобби (комнату)
  socket.on('lobbyJoin', (data) => {
    const { roomId, playerName } = data;

    if (!rooms[roomId]) {
      rooms[roomId] = { players: {}, started: false };
    }

    socket.join(roomId);

    // определяем команду: 1 или 2
    const teams = Object.values(rooms[roomId].players).map(p => p.team);
    const nextTeam = teams.length > 0 && teams.every(t => t === 1) ? 2 : 1;

    rooms[roomId].players[socket.id] = {
      id: socket.id,
      name: playerName || 'Игрок',
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      dir: 'down',
      size: 40,
      score: 0,
      ready: false,
      team: nextTeam
    };

    // 1) самому игроку
    socket.emit('id', socket.id);
    socket.emit('currentPlayers', Object.values(rooms[roomId].players));

    // 2) всем в комнате — обновить список игроков и счётчик
    io.to(roomId).emit('playerCount', {
      roomId,
      count: Object.keys(rooms[roomId].players).length
    });

    io.to(roomId).emit('newPlayer', rooms[roomId].players[socket.id]);
  });

  // 3) старт матча
  socket.on('startGame', (roomId) => {
    if (rooms[roomId] && Object.keys(rooms[roomId].players).length >= 2) {
      rooms[roomId].started = true;
      io.to(roomId).emit('gameStart', roomId);
    }
  });

  // 4) движение игрока
  socket.on('move', (data) => {
    const roomId = Array.from(socket.rooms)[1]; // первое — common, второе — roomId
    if (rooms[roomId]?.players[socket.id]) {
      rooms[roomId].players[socket.id] = {
        ...rooms[roomId].players[socket.id],
        x: data.x,
        y: data.y,
        dir: data.dir
      };
      socket.to(roomId).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        dir: data.dir
      });
    }
  });

  // 5) отключение игрока
  socket.on('disconnect', () => {
    console.log(`🔴 Игрок отключился: ${socket.id}`);
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        io.to(roomId).emit('playerCount', {
          roomId,
          count: Object.keys(rooms[roomId].players).length
        });
        break;
      }
    }
  });
});

// RENDER PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🌴 Tongan Beach работает на порту ${port}`);
  console.log(`🌐 https://tonganbeach.onrender.com`);
});
