import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { User, Detection, JoinSessionData, DetectionData, VideoFrameData, SocketData } from '../types';
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

        // Handle video frame from user
        socket.on('video-frame', (frameData: VideoFrameData) => {
            handleVideoFrame(socket, io, frameData);
        });

        // Handle stop video stream from user
        socket.on('stop-video-stream', (data: { userId: string; userName: string }) => {
            handleStopVideoStream(socket, io, data);
        });

        // Handle request for users list (for admin dashboard)
        socket.on('request-users-list', () => {
            handleRequestUsersList(socket);
        });

        // Handle disconnect - built-in Socket.IO event
        socket.on('disconnect', () => {
            handleDisconnect(socket, io);
        });

    });
}

// Helper function to send users list - eliminates code duplication
function sendUsersList(socket: Socket, context: string) {
    const allUsers = dataService.getAllUsers().map(user => ({
        id: user.id,
        name: user.name,
        isActive: user.isActive,
        joinedAt: user.joinedAt
    }));
    
    socket.emit('users-list', allUsers);
    console.log(`📋 Sent users list ${context}: ${allUsers.length} users`);
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

    // Tell OTHER people that this user joined
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

    // Tell ONLY this user that they successfully joined
    sendUsersList(socket, `to ${data.userName} after joining`);
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

function handleVideoFrame(socket: Socket, io: Server, frameData: VideoFrameData) {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;
    const userName = socketData.userName;

    if (!userId || !userName) {
        socket.emit('error', { message: 'User not in session' });
        return;
    }

    // Only log every 10th frame to reduce console spam
    if (Math.random() < 0.1) {
        console.log(`📹 Video frame from ${userName}`);
    }

    // Broadcast video frame to all other clients with minimal processing
    socket.broadcast.emit('video-frame', {
        userId: userId,
        userName: userName,
        frameData: frameData.frameData,
        timestamp: new Date().toISOString()
    });
}

function handleStopVideoStream(socket: Socket, io: Server, data: { userId: string; userName: string }) {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;
    const userName = socketData.userName;

    if (!userId || !userName) {
        socket.emit('error', { message: 'User not in session' });
        return;
    }

    console.log(`⏹️ Video stream stopped from ${userName}`);

    // Broadcast stop video stream to all other clients
    socket.broadcast.emit('stop-video-stream', {
        userId: userId,
        userName: userName
    });
}

function handleRequestUsersList(socket: Socket) {
    console.log(`📋 Admin dashboard requesting users list`);
    sendUsersList(socket, 'to admin dashboard');
}
