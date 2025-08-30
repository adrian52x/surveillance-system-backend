import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { User, Detection, JoinSessionData, DetectionData, SocketData } from '../types';
import { dataService } from '../services/dataService';

export function setupSocketHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Handle user joining a session
        socket.on('join-session', (data: JoinSessionData) => {
            handleJoinSession(socket, io, data);
        });

        // Handle new detection from user
        socket.on('detection', (detectionData: DetectionData) => {
            handleDetection(socket, io, detectionData);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            handleDisconnect(socket, io);
        });

    });
}

function handleJoinSession(socket: Socket, io: Server, data: JoinSessionData) {
    const userId = data.userId || uuidv4();
    
    const user: User = {
        id: userId,
        name: data.userName,
        socketId: socket.id,
        isActive: true,
        joinedAt: new Date()
    };

    // Store user data
    dataService.addUser(user);
    const socketData = socket.data as SocketData;
    socketData.userId = userId;
    socketData.userName = data.userName;

    console.log(`👤 User joined: ${data.userName} (${userId})`);

    // Broadcast to all OTHER clients that a new user joined
    socket.broadcast.emit('user-joined', {
        userId: userId,
        userName: data.userName,
        timestamp: new Date().toISOString()
    });

    // Send back the userId to the client
    socket.emit('session-joined', {
        userId: userId,
        userName: data.userName,
        connectedUsers: dataService.getUsersCount()
    });

    // Send ALL users list to the new user
    const allUsers = dataService.getAllUsers().map(user => ({
        id: user.id,
        name: user.name,
        isActive: user.isActive,
        joinedAt: user.joinedAt
    }));
    
    socket.emit('users-list', allUsers);
    console.log(`📋 Sent users list to ${data.userName}: ${allUsers.length} users, socketID: ${socket.id}`);
}

function handleDetection(socket: Socket, io: Server, detectionData: DetectionData) {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;
    const userName = socketData.userName;

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

    // Store detection
    dataService.addDetection(detection);

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
}

function handleDisconnect(socket: Socket, io: Server) {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;
    const userName = socketData.userName;

    if (userId && dataService.hasUser(userId)) {
        dataService.removeUser(userId);
        console.log(`👋 User disconnected: ${userName} (${userId})`);

        // Broadcast user left
        socket.broadcast.emit('user-left', {
            userId: userId,
            userName: userName,
            timestamp: new Date().toISOString()
        });
    }

    console.log(`🔌 Client disconnected: ${socket.id}`);
}
