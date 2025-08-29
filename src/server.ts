import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { Socket } from 'socket.io';

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

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000"
}));
app.use(express.json());

// In-memory storage for testing (we'll replace this with DB later)
interface User {
  id: string;
  name: string;
  socketId: string;
  isActive: boolean;
  joinedAt: Date;
}

interface Detection {
  id: string;
  userId: string;
  userName: string;
  objectClass: string;
  confidence: number;
  bbox: [number, number, number, number];
  timestamp: Date;
}

let connectedUsers: Map<string, User> = new Map();
let recentDetections: Detection[] = [];

// Basic API Routes


app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    totalDetections: recentDetections.length
  });
});

app.get('/api/users', (req, res) => {
  const users = Array.from(connectedUsers.values()).map(user => ({
    id: user.id,
    name: user.name,
    isActive: user.isActive,
    joinedAt: user.joinedAt
  }));
  res.json(users);
});

app.get('/api/detections', (req, res) => {
  // Return last 100 detections
  const recent = recentDetections.slice(-100).reverse();
  res.json(recent);
});

// WebSocket handling
io.on('connection', (socket: Socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Handle user joining a session
  socket.on('join-session', (data: { userId?: string; userName: string }) => {
    const userId = data.userId || uuidv4();
    
    const user: User = {
      id: userId,
      name: data.userName,
      socketId: socket.id,
      isActive: true,
      joinedAt: new Date()
    };

    connectedUsers.set(userId, user);
    socket.data.userId = userId;
    socket.data.userName = data.userName;

    // Join user to their own room
    socket.join(`user-${userId}`);

    console.log(`👤 User joined: ${data.userName} (${userId})`);

    // Broadcast to all OTHER clients that a new user joined (not to the user themselves)
    socket.broadcast.emit('user-joined', {
      userId: userId,
      userName: data.userName,
      timestamp: new Date().toISOString()
    });

    // Send back the userId to the client
    socket.emit('session-joined', {
      userId: userId,
      userName: data.userName,
      connectedUsers: connectedUsers.size
    });

    // Send ALL users list to the new user (including themselves)
    const allUsers = Array.from(connectedUsers.values()).map(user => ({
      id: user.id,
      name: user.name,
      isActive: user.isActive,
      joinedAt: user.joinedAt
    }));
    socket.emit('users-list', allUsers);
    
    console.log(`📋 Sent users list to ${data.userName}: ${allUsers.length} users (including self)`);
  });

  // Handle new detection from user
  socket.on('detection', (detectionData: {
    objectClass: string;
    confidence: number;
    bbox: [number, number, number, number];
  }) => {
    const userId = socket.data.userId;
    const userName = socket.data.userName;

    if (!userId || !userName) {
      socket.emit('error', { message: 'User not in session' });
      return;
    }

    const detection: Detection = {
      id: uuidv4(),
      userId: userId,
      userName: userName,
      objectClass: detectionData.objectClass,
      confidence: detectionData.confidence,
      bbox: detectionData.bbox,
      timestamp: new Date()
    };

    // Store detection (in memory for now)
    recentDetections.push(detection);

    // Keep only last 1000 detections in memory
    if (recentDetections.length > 1000) {
      recentDetections = recentDetections.slice(-1000);
    }

    console.log(`🎯 Detection from ${userName}: ${detectionData.objectClass} (${(detectionData.confidence * 100).toFixed(1)}%)`);

    // Broadcast detection to all connected clients
    io.emit('new-detection', {
      id: detection.id,
      userId: userId,
      userName: userName,
      objectClass: detectionData.objectClass,
      confidence: detectionData.confidence,
      bbox: detectionData.bbox,
      timestamp: detection.timestamp.toISOString()
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    const userName = socket.data.userName;

    if (userId && connectedUsers.has(userId)) {
      connectedUsers.delete(userId);
      console.log(`👋 User disconnected: ${userName} (${userId})`);

      // Broadcast user left
      socket.broadcast.emit('user-left', {
        userId: userId,
        userName: userName,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔌 Client disconnected: ${socket.id}`);
  });

  // Handle ping for connection testing
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🌐 Accepting connections from: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});

export default app;
