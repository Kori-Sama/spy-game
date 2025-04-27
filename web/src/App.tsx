import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toast } from 'antd-mobile'
import Login from './pages/Login'
import Home from './pages/Home'
import Room from './pages/Room'
import Game from './pages/Game'
import NotFound from './pages/NotFound'
import './App.css'
import { useSocketStore } from './stores/socketStore'
import { useUserStore } from './stores/userStore'

function App() {
  const { initSocket, socket } = useSocketStore()
  const { user } = useUserStore()

  // 初始化Socket连接
  useEffect(() => {
    initSocket()

    return () => {
      socket?.disconnect()
    }
  }, [initSocket, socket])

  // 设置错误监听
  useEffect(() => {
    if (socket) {
      socket.on('error', (data) => {
        Toast.show({
          content: data.message,
          position: 'bottom',
        })
      })

      return () => {
        socket.off('error')
      }
    }
  }, [socket])

  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/home"
          element={user ? <Home /> : <Navigate to="/" replace />}
        />
        <Route
          path="/room/:roomId"
          element={user ? <Room /> : <Navigate to="/" replace />}
        />
        <Route
          path="/game/:roomId"
          element={user ? <Game /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default App
