import express, { Express, Request, Response } from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import { GameManager } from './game/GameManager'
import { setupSocketHandlers } from './io'
import dotenv from 'dotenv'

dotenv.config()

const app: Express = express()
const port = process.env.PORT || 3000
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

// Middleware
app.use(cors({
  origin: frontendUrl,
  credentials: true,
  methods: ['GET', 'POST']
}))
app.use(express.json())

// HTTP Server
const httpServer = createServer(app)

// Socket.io Server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
})

// Game Manager
const gameManager = new GameManager()

// Routes
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.get('/api/stats', (req: Request, res: Response) => {
  res.json({
    activeLobbies: gameManager.getActiveLobbyCount(),
    totalGames: gameManager.getTotalGamesPlayed(),
    uptime: process.uptime()
  })
})

// Socket.io Events
setupSocketHandlers(io, gameManager)

// Error handling
app.use((err: any, req: Request, res: Response) => {
  console.error('❌ Error:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Start Server
httpServer.listen(port, () => {
  console.log('🚀 Server running on http://localhost:' + port)
  console.log('📡 WebSocket ready for connections')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  httpServer.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
})

export { app, io, gameManager }
