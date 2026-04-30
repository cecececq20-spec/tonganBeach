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

// ✅ СТАТИКА ИЗ КОРНЯ (твоя структура)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = {};  // {roomId: {players: {}, started: false}}

io.on('connection', (socket) => {
  console.log(`Игрок подключился: ${socket.id}`);
  
  // Создать/присоединиться к комнате
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
      team: Object.keys(rooms[roomId].players).length % 2 + 1  // 1 или 2
    };
    
    io.to(roomId).emit('lobbyUpdate', {
      roomId,
      players: Object.values(rooms[roomId].players),
      started: rooms[roomId].started
    });
  });
  
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
  
  socket.on('startGame', (roomId) => {
    if (rooms[roomId] && Object.keys(rooms[roomId].players).length >= 2) {
      rooms[roomId].started = true;
      io.to(roomId).emit('gameStart', roomId);
    }
  });
  
  socket.on('move', (data) => {
    const roomId = Array.from(socket.rooms)[1];
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

// ✅ RENDER PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🌴 Tongan Beach на порту ${port}`);
  console.log(`📱 https://tonganbeach.onrender.com`);
});
