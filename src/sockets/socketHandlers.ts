import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { User, Detection, DetectionPayload, JoinSessionData, VideoFrameData, SocketData } from '../types';
import { dataService } from '../services/dataService';
import { discordService } from '../services/discordService';


// Simple person detection counter
const personCounters: Record<string, { count: number; firstDetection: Date }> = {};

// Store latest frame for each user
const latestFrames: Record<string, string> = {};

// Detection confirmation constants
const REQUIRED_DETECTIONS = 10;  // Number of detections needed to confirm
const TIME_WINDOW_SECONDS = 10;  // Maximum time window in seconds
const TRACKING_OBJECT = 'person'; // Object class to track

export function setupSocketHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Handle user joining a session
        socket.on('join-session', (data: JoinSessionData) => {
            handleJoinSession(socket, io, data);
        });

        // Handle new detection from user
        socket.on('detection', (detectionData: DetectionPayload) => {
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

        // Handle Discord notifications toggle (Admin only)
        socket.on('toggle-discord-notifications', (data: { enabled: boolean }) => {
            handleToggleDiscordNotifications(socket, data);
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

async function handleDetection(socket: Socket, io: Server, detectionData: DetectionPayload) {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;
    const userName = socketData.userName;

    if (!userId || !userName) {
        socket.emit('error', { message: 'User not in session' });
        return;
    }

    // Only track person detections
    if (detectionData.objectClass === TRACKING_OBJECT) {
        const now = new Date();
        
        if (personCounters[userId]) {
            // Update existing counter
            personCounters[userId].count++;
            
            const timeRange = now.getTime() - personCounters[userId].firstDetection.getTime();
            const timeInSeconds = timeRange / 1000;
            
            console.log(`👀 Person detection #${personCounters[userId].count} from ${userName} (${timeInSeconds.toFixed(1)}s)`);
            
            // Check if we have required detections and they're within time window
            if (personCounters[userId].count >= REQUIRED_DETECTIONS && timeInSeconds <= TIME_WINDOW_SECONDS) {
                // CONFIRMED PERSON!
                console.log(`🚨 PERSON CONFIRMED!`);
                console.log(`👤 User: ${userName}`);
                console.log(`📊 Detections: ${personCounters[userId].count} in ${timeInSeconds.toFixed(1)} seconds`);
                console.log(`🕐 Time: ${personCounters[userId].firstDetection.toLocaleTimeString()} --- ${now.toLocaleTimeString()}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                
                // Store initial detection time before resetting counter
                const initialTimestamp = personCounters[userId].firstDetection;
                
                // Reset counter IMMEDIATELY to prevent duplicate notifications
                delete personCounters[userId];
                
                // Send Discord notification with latest frame (if available)
                const latestFrame = latestFrames[userId];
                await discordService.sendPersonDetectionAlert(
                    userName,
                    initialTimestamp,
                    now,
                    latestFrame
                );

                // Create and broadcast detection
                const detection: Detection = {
                    id: uuidv4(),
                    userId: userId,
                    userName: userName,
                    objectClass: detectionData.objectClass,
                    timestampInitial: initialTimestamp,
                    timestampFinal: now
                };

                //dataService.addDetection(detection);

                socket.emit('new-detection', detection);
                
                // socket.emit('person-confirmed', {
                //     message: `Person confirmed! ${personCounters[userKey]?.count || 10} detections in ${timeInSeconds.toFixed(1)}s`
                // });
                
            } else if (timeInSeconds > 10) {
                // Time window exceeded, reset counter
                console.log(`⏰ Time window exceeded for ${userName}, resetting counter`);
                personCounters[userId] = {
                    count: 1,
                    firstDetection: now
                };
            }
        } else {
            // Start new counter
            personCounters[userId] = {
                count: 1,
                firstDetection: now
            };
            console.log(`🔍 Started counting person detections for ${userName}`);
        }
    } else {
        // Non-person detection - just log (optional)
        console.log(`📋 Non-person detection from ${userName}: ${detectionData.objectClass}`);
    }
}

function handleDisconnect(socket: Socket, io: Server) {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;
    const userName = socketData.userName;

    if (userId && dataService.hasUser(userId)) {
        dataService.removeUser(userId);
        
        // Clean up person counter for this user
        if (personCounters[userId]) {
            delete personCounters[userId];
            console.log(`🧹 Cleared person counter for ${userName}`);
        }
        
        // Clean up latest frame for this user
        if (latestFrames[userId]) {
            delete latestFrames[userId];
            console.log(`🧹 Cleared latest frame for ${userName}`);
        }
        
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

    // Store the latest frame for this user
    latestFrames[userId] = frameData.frameData;

    // Only log every 10th frame to reduce console spam
    // if (Math.random() < 0.1) {
    //     console.log(`📹 Video frame from ${userName}`);
    // }

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

function handleToggleDiscordNotifications(socket: Socket, data: { enabled: boolean }) {
    const socketData = socket.data as SocketData;
    const userName = socketData.userName;

    // Update Discord service state
    discordService.setNotificationsEnabled(data.enabled);
    
    console.log(`🔔 Admin ${userName} ${data.enabled ? 'enabled' : 'disabled'} Discord notifications`);
    
    // Confirm to the admin
    socket.emit('discord-notifications-toggled', { 
        enabled: data.enabled,
        message: `Discord notifications ${data.enabled ? 'enabled' : 'disabled'}` 
    });
}
