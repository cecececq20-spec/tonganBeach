const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const gameState = { players: {} };

io.on('connection', (socket) => {
    console.log(`Player ${socket.id} connected`);
    
    socket.on('join', (playerData) => {
        gameState.players[socket.id] = { id: socket.id, ...playerData };
        io.emit('playersUpdate', Object.values(gameState.players));
    });
    
    socket.on('move', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id] = { ...gameState.players[socket.id], ...data };
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

server.listen(process.env.PORT || 3000, () => {
    console.log('Tongan Beach MP server running!');
});
