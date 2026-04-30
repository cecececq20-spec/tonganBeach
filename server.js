const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" } 
});

// ЧИТАЕТ ФАЙЛЫ ИЗ КОРНЯ (твоя структура!)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const gameState = { players: {} };

io.on('connection', (socket) => {
    console.log(`Игрок ${socket.id} подключился`);
    
    socket.on('join', (data) => {
        gameState.players[socket.id] = { 
            id: socket.id, 
            x: 100, y: 100, 
            score: 0, 
            dir: 'down',
            ...data 
        };
        io.emit('playersUpdate', Object.values(gameState.players));
    });
    
    socket.on('move', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id] = { 
                ...gameState.players[socket.id], 
                ...data 
            };
            socket.broadcast.emit('playerMoved', gameState.players[socket.id]);
        }
    });
    
    socket.on('pickup', (data) => {
        io.emit('itemPicked', data);
    });
    
    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('playersUpdate', Object.values(gameState.players));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Tongan Beach MP на порту ${PORT}`);
});
