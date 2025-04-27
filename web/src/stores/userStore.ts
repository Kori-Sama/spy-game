import { create } from 'zustand'
import axios from 'axios'
import { User } from '../../../shared/types'

interface UserState {
    user: User | null
    setUser: (user: User) => void
    register: (username: string) => Promise<User>
}

export const useUserStore = create<UserState>((set) => ({
    user: null,

    setUser: (user) => set({ user }),

    register: async (username) => {
        try {
            const response = await axios.post('http://localhost:3000/api/register', { username })
            const user = response.data.user
            set({ user })
            // 保存到本地存储以实现持久化登录
            localStorage.setItem('user', JSON.stringify(user))
            return user
        } catch (error) {
            console.error('注册失败:', error)
            throw error
        }
    }
}))

// 初始化时从本地存储加载用户信息
const storedUser = localStorage.getItem('user')
if (storedUser) {
    useUserStore.getState().setUser(JSON.parse(storedUser))
}