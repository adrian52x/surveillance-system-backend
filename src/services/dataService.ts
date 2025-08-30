import { User, Detection } from '../types';

class DataService {
    private static instance: DataService;
    private connectedUsers: Map<string, User> = new Map();
    private recentDetections: Detection[] = [];
    private readonly MAX_DETECTIONS = 1000;

    private constructor() {
        // Private constructor prevents direct instantiation
    }

    public static getInstance(): DataService {
        if (!DataService.instance) {
            DataService.instance = new DataService();
        }
        return DataService.instance;
    }

    // User management
    addUser(user: User): void {
        this.connectedUsers.set(user.id, user);
    }

    removeUser(userId: string): User | undefined {
        const user = this.connectedUsers.get(userId);
        if (user) {
        this.connectedUsers.delete(userId);
        }
        return user;
    }

    getUser(userId: string): User | undefined {
        return this.connectedUsers.get(userId);
    }

    getAllUsers(): User[] {
        return Array.from(this.connectedUsers.values());
    }

    getUsersCount(): number {
        return this.connectedUsers.size;
    }

    hasUser(userId: string): boolean {
        return this.connectedUsers.has(userId);
    }

    // Detection management
    addDetection(detection: Detection): void {
        this.recentDetections.push(detection);
        
        // Keep only last MAX_DETECTIONS in memory
        if (this.recentDetections.length > this.MAX_DETECTIONS) {
        this.recentDetections = this.recentDetections.slice(-this.MAX_DETECTIONS);
        }
    }

    getRecentDetections(limit: number = 100): Detection[] {
        return this.recentDetections.slice(-limit).reverse();
    }

    getDetectionsCount(): number {
        return this.recentDetections.length;
    }
}

// Singleton instance
export const dataService = DataService.getInstance();
