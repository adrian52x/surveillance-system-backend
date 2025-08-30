import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { setupMiddleware } from './middleware';
import { setupSocketHandlers } from './sockets/socketHandlers';
import apiRoutes from './routes/api';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

// Setup middleware
setupMiddleware(app);

// Setup routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'Object Detection Backend API',
        status: 'running',
        endpoints: {
            health: '/api/health',
            detections: '/api/detections',
            users: '/api/users',
            stats: '/api/stats',
            websocket: 'Connect via Socket.IO'
        }
    });
});

app.use('/api', apiRoutes);

// Setup WebSocket handlers
setupSocketHandlers(io);

server.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready for connections`);
    console.log(`🌐 Accepting connections from: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});

export default app;
