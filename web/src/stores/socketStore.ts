import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types'
import { useUserStore } from './userStore'

interface SocketState {
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null
    isConnected: boolean
    initSocket: () => void
    disconnect: () => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
    socket: null,
    isConnected: false,

    initSocket: () => {
        const { socket } = get()

        if (socket) {
            return
        }

        // 创建新的Socket连接
        const newSocket = io('http://localhost:3000')

        newSocket.on('connect', () => {
            console.log('Socket已连接')
            set({ isConnected: true })

            // 如果用户已登录，则进行认证
            const user = useUserStore.getState().user
            if (user) {
                newSocket.emit('authenticate', { userId: user.id })
            }
        })

        newSocket.on('disconnect', () => {
            console.log('Socket已断开')
            set({ isConnected: false })
        })

        set({ socket: newSocket })
    },

    disconnect: () => {
        const { socket } = get()
        if (socket) {
            socket.disconnect()
            set({ socket: null, isConnected: false })
        }
    }
}))