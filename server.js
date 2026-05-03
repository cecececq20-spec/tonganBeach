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

// ✅ СТАТИКА (index.html + все текстуры)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// КОМНАТЫ
const rooms = {};  // {roomId: {players: {}, started: false}}

io.on('connection', (socket) => {
  console.log(`⚽ Игрок ${socket.id} подключился`);

  // 1) доступные комнаты (не стартованные)
  socket.emit('availableRooms',
    Object.keys(rooms).filter(id => !rooms[id].started)
  );

  // 2) вход в лобби
  socket.on('lobbyJoin', (data) => {
    const { roomId, playerName } = data;
    console.log(`🎮 lobbyJoin ${socket.id} → ${roomId} (${playerName})`);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: {}, started: false };
    }

    socket.join(roomId);

    // команда 1 или 2
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

    // 2) всем в комнате
    io.to(roomId).emit('playerCount', {
      roomId,
      count: Object.keys(rooms[roomId].players).length
    });

    // 3) обновление лобби (для uiUpdateLobby)
    io.to(roomId).emit('lobbyUpdate', {
      roomId,
      players: Object.values(rooms[roomId].players),
      started: rooms[roomId].started
    });
  });

  // 3) СТАРТ МАТЧА (🔥 ЭТО ГЛАВНОЕ!)
  socket.on('startGame', (roomId) => {
    console.log(`🎮 startGame ${socket.id} → ${roomId}`);
    console.log(`  players: ${Object.keys(rooms[roomId]?.players || {}).length}`);

    if (rooms[roomId] && Object.keys(rooms[roomId].players).length >= 2) {
      rooms[roomId].started = true;
      io.to(roomId).emit('gameStart', roomId);
      console.log(`✅ gameStart отправлен в ${roomId}`);
    } else {
      console.log(`❌ недостаточно игроков в ${roomId}`);
    }
  });

  // 4) движение
  socket.on('move', (data) => {
    const roomId = Array.from(socket.rooms)[1];
    if (rooms[roomId]?.players[socket.id]) {
      rooms[roomId].players[socket.id].x = data.x;
      rooms[roomId].players[socket.id].y = data.y;
      rooms[roomId].players[socket.id].dir = data.dir;
      socket.to(roomId).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        dir: data.dir
      });
    }
  });

  // 5) отключение
  socket.on('disconnect', () => {
    console.log(`🔴 ${socket.id} отключился`);
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        io.to(roomId).emit('playerCount', {
          roomId,
          count: Object.keys(rooms[roomId].players).length
        });
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

// PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🌴 Tongan Beach: порт ${port}`);
  console.log(`🌐 https://tonganbeach.onrender.com`);
});
