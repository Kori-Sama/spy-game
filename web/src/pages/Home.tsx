import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Dialog, Toast, NavBar, Space, Empty } from 'antd-mobile'
import { useUserStore } from '../stores/userStore'
import { useRoomStore } from '../stores/roomStore'
import { GameStatus } from '../../../shared/types'

const Home = () => {
    const navigate = useNavigate()
    const { user } = useUserStore()
    const { rooms, fetchRooms, createRoom, joinRoom, setupRoomEvents } = useRoomStore()
    const [loading, setLoading] = useState(false)
    const [joinRoomId, setJoinRoomId] = useState('')

    useEffect(() => {
        // 确保设置Socket事件监听
        setupRoomEvents()

        // 获取房间列表
        fetchRooms()

        // 定时刷新房间列表
        const intervalId = setInterval(() => {
            fetchRooms()
        }, 10000)

        return () => {
            clearInterval(intervalId)
        }
    }, [fetchRooms, setupRoomEvents])

    const handleCreateRoom = async () => {
        try {
            setLoading(true)
            const roomId = await createRoom()
            navigate(`/room/${roomId}`)
        } catch (error) {
            console.error('创建房间失败:', error)
            Toast.show({
                content: '创建房间失败，请重试',
                position: 'bottom',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleJoinRoom = async () => {
        try {
            const inputValue = await Dialog.prompt({
                title: '加入房间',
                content: '请输入房间号',
                confirmText: '加入',
                cancelText: '取消',
            })

            if (inputValue && inputValue.trim()) {
                setJoinRoomId(inputValue.trim())
                setLoading(true)
                await joinRoom(inputValue.trim())
                navigate(`/room/${inputValue.trim()}`)
            }
        } catch (error) {
            console.error('加入房间失败:', error)
            Toast.show({
                content: error instanceof Error ? error.message : '加入房间失败，请重试',
                position: 'bottom',
            })
        } finally {
            setLoading(false)
            setJoinRoomId('')
        }
    }

    const handleLogout = () => {
        Dialog.confirm({
            title: '退出登录',
            content: '确定要退出登录吗？',
            confirmText: '退出',
            cancelText: '取消',
            onConfirm: () => {
                localStorage.removeItem('user')
                window.location.href = '/'
            },
        })
    }

    const renderRoomStatusBadge = (status: GameStatus) => {
        let text = ''
        switch (status) {
            case GameStatus.WAITING:
                text = '等待中'
                break
            case GameStatus.PLAYING:
                text = '进行中'
                break
            case GameStatus.VOTING:
                text = '投票中'
                break
            case GameStatus.ENDED:
                text = '已结束'
                break
        }

        return <span className={`room-status ${status}`}>{text}</span>
    }

    // 过滤掉已结束的房间
    const activeRooms = rooms.filter(room => room.status !== GameStatus.ENDED)

    return (
        <div className="page-container">
            <NavBar
                right={<Button size='small' onClick={handleLogout}>退出</Button>}
                back={null}
            >
                游戏大厅
            </NavBar>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>欢迎, {user?.username}</h2>
                    <Space>
                        <Button
                            color="primary"
                            onClick={handleCreateRoom}
                            loading={loading}
                            disabled={loading}
                        >
                            创建房间
                        </Button>
                        <Button
                            onClick={handleJoinRoom}
                            loading={joinRoomId !== '' && loading}
                            disabled={loading}
                        >
                            加入房间
                        </Button>
                    </Space>
                </div>
            </div>

            <div className="card">
                <h3>可用房间</h3>
                {activeRooms.length > 0 ? (
                    <div style={{ marginTop: '16px' }}>
                        {activeRooms.map(room => (
                            <div key={room.id} className="room-list-item">
                                <div>
                                    <div>房间号: {room.id}</div>
                                    <div>玩家数: {Object.keys(room.players).length}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {renderRoomStatusBadge(room.status)}
                                    <Button
                                        size="small"
                                        disabled={room.status !== GameStatus.WAITING || loading}
                                        onClick={async () => {
                                            try {
                                                setLoading(true)
                                                await joinRoom(room.id)
                                                navigate(`/room/${room.id}`)
                                            } catch (error) {
                                                console.error('加入房间失败:', error)
                                                Toast.show({
                                                    content: '加入房间失败，请重试',
                                                    position: 'bottom',
                                                })
                                            } finally {
                                                setLoading(false)
                                            }
                                        }}
                                    >
                                        加入
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty
                        style={{ padding: '32px 0' }}
                        description="暂无可用房间"
                    />
                )}
            </div>
        </div>
    )
}

export default Home