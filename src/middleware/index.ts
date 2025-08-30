import cors from 'cors';
import express from 'express';

export function setupMiddleware(app: express.Application) {
  // CORS configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000"
  }));

  // JSON parsing
  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}
