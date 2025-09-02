export interface User {
  id: string;
  name: string;
  socketId: string;
  isActive: boolean;
  joinedAt: Date;
}

export interface Detection {
  id: string;
  userId: string;
  userName: string;
  objectClass: string;
  confidence: number;
  bbox: [number, number, number, number];
  timestamp: Date;
}

export interface JoinSessionData {
  userId?: string;
  userName: string;
}

export interface DetectionData {
  objectClass: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface VideoFrameData {
  userId: string;
  userName: string;
  frameData: string;
  timestamp: string;
}

export interface SocketData {
  userId?: string;
  userName?: string;
}
