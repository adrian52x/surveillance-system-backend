import { Router } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connectedUsers: dataService.getUsersCount(),
    totalDetections: dataService.getDetectionsCount()
  });
});

// Get recent detections
router.get('/detections', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const recent = dataService.getRecentDetections(limit);
  res.json(recent);
});

// Get connected users
router.get('/users', (req, res) => {
  const users = dataService.getAllUsers().map(user => ({
    id: user.id,
    name: user.name,
    isActive: user.isActive,
    joinedAt: user.joinedAt
  }));
  res.json(users);
});

// Get user statistics
router.get('/stats', (req, res) => {
  const stats = {
    connectedUsers: dataService.getUsersCount(),
    totalDetections: dataService.getDetectionsCount(),
    timestamp: new Date().toISOString()
  };
  res.json(stats);
});

export default router;
