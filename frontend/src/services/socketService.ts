import { io, Socket } from 'socket.io-client'

let socketInstance: Socket | null = null

export function initializeSocket(url: string): Socket {
  if (socketInstance) return socketInstance

  socketInstance = io(url, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
  })

  socketInstance.on('connect', () => {
    console.log('✅ Socket connected:', socketInstance?.id)
  })

  socketInstance.on('disconnect', () => {
    console.log('❌ Socket disconnected')
  })

  socketInstance.on('error', (error) => {
    console.error('🔴 Socket error:', error)
  })

  return socketInstance
}

export function getSocket(): Socket | null {
  return socketInstance
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
