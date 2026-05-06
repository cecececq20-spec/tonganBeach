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

// ✅ СТАТИКА (index.html + текстуры)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 5v5 КОМНАТЫ
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

    // 5v5: 5 синих, потом 5 красных
    const blueCount = Object.values(rooms[roomId].players).filter(p => p.team === 1).length;
    const redCount = Object.values(rooms[roomId].players).filter(p => p.team === 2).length;
    const nextTeam = (blueCount < 5) ? 1 : (redCount < 5 ? 2 : 1);

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
    const playerCount = Object.keys(rooms[roomId].players).length;
    io.to(roomId).emit('playerCount', {
      roomId,
      count: playerCount
    });

    // 3) обновление лобби для uiUpdateLobby
    io.to(roomId).emit('lobbyUpdate', {
      roomId,
      players: Object.values(rooms[roomId].players),
      started: rooms[roomId].started
    });
  });

  // 3) СТАРТ 5v5 (10 игроков)
  socket.on('startGame', (roomId) => {
    console.log(`🎮 5v5 startGame ${socket.id} → ${roomId}`);
    
    const playerCount = Object.keys(rooms[roomId]?.players || {}).length;
    console.log(`  игроков: ${playerCount}/10`);

    if (rooms[roomId] && playerCount >= 10) {
      rooms[roomId].started = true;
      io.to(roomId).emit('gameStart', roomId);
      console.log(`✅ 5v5 gameStart отправлен в ${roomId}`);
    } else {
      socket.emit('playerCount', {
        roomId,
        count: playerCount
      });
      console.log(`⏳ ждём 10 игроков (сейчас ${playerCount})`);
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
        const playerCount = Object.keys(rooms[roomId].players).length;
        io.to(roomId).emit('playerCount', {
          roomId,
          count: playerCount
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
  console.log(`🌴 Tongan Beach 5v5: порт ${port}`);
  console.log(`🌐 https://tonganbeach.onrender.com`);
});
