# Backend Architecture

## 📁 Project Structure

```
src/
├── server.ts                   # Main entry point
├── types/
│   └── index.ts               # TypeScript interfaces and types
├── middleware/
│   └── index.ts               # Express middleware setup
├── routes/
│   └── api.ts                 # REST API routes
├── sockets/
│   └── socketHandlers.ts      # WebSocket event handlers
└── services/
    └── dataService.ts         # Data management service
```

## 🏗️ Architecture Benefits

### **Separation of Concerns**
- **Routes**: Handle HTTP REST API endpoints
- **Sockets**: Handle WebSocket real-time events
- **Services**: Business logic and data management
- **Types**: Centralized type definitions
- **Middleware**: Reusable Express middleware

### **Maintainability**
- Each file has a single responsibility
- Easy to find and modify specific functionality
- Clear import/export structure

### **Scalability**
- Easy to add new routes or socket events
- Services can be easily replaced (e.g., database service)
- Modular design allows team collaboration

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info and available endpoints |
| GET | `/api/health` | Health check with stats |
| GET | `/api/detections` | Get recent detections |
| GET | `/api/users` | Get connected users |
| GET | `/api/stats` | Get system statistics |

## 🔌 WebSocket Events

### **Client → Server**
- `join-session`: User joins with name
- `detection`: New object detection data
- `ping`: Connection test
- `disconnect`: User leaves

### **Server → Client**
- `user-joined`: New user connected
- `user-left`: User disconnected
- `session-joined`: Confirmation of join
- `users-list`: All connected users
- `new-detection`: Real-time detection
- `pong`: Ping response

## 🔧 Usage

### Start Development Server
```bash
npm run dev
```

### Add New API Route
1. Edit `src/routes/api.ts`
2. Add your route handler

### Add New Socket Event
1. Edit `src/sockets/socketHandlers.ts`
2. Add event handler in `setupSocketHandlers`

### Add New Data Type
1. Edit `src/types/index.ts`
2. Export your interface

## 🚀 Next Steps

- Replace `dataService` with database (MongoDB, PostgreSQL)
- Add authentication middleware
- Add validation middleware
- Add error handling middleware
- Add logging service
- Add environment-specific configurations
