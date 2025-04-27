import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, User, PlayerRole, GameStatus } from '../../shared/types';
import * as userService from './userService';
import * as roomService from './roomService';

// 定义接受客户端事件的socket类型
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// 保存用户ID与socket的映射
const userSockets = new Map<string, TypedSocket>();

// 初始化Socket.io服务
export function initSocketService(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    io.on('connection', (socket: TypedSocket) => {
        console.log(`用户已连接: ${socket.id}`);

        // 用户认证
        socket.on('authenticate', async (data) => {
            try {
                const user = await userService.getUserById(data.userId);
                if (user) {
                    console.log(`用户已认证: ${user.username}`);
                    // 保存用户与socket的关联
                    socket.data.user = user;
                    userSockets.set(user.id, socket);
                } else {
                    socket.emit('error', { message: '用户不存在' });
                }
            } catch (error) {
                console.error('认证错误:', error);
                socket.emit('error', { message: '认证失败' });
            }
        });

        // 创建房间
        socket.on('create_room', async () => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const newRoom = await roomService.createRoom(socket.data.user.id);

                // 将socket加入房间频道
                socket.join(newRoom.id);

                // 通知用户房间已创建
                socket.emit('room_created', { roomId: newRoom.id, room: newRoom });

                // 广播房间列表更新
                broadcastRoomsUpdate(io);
            } catch (error) {
                console.error('创建房间错误:', error);
                socket.emit('error', { message: '创建房间失败' });
            }
        });

        // 加入房间
        socket.on('join_room', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const room = await roomService.joinRoom(data.roomId, socket.data.user.id);

                // 将socket加入房间频道
                socket.join(room.id);

                // 通知用户已加入房间
                socket.emit('room_joined', { room });

                // 通知房间内所有用户有新玩家加入
                io.to(room.id).emit('player_joined', {
                    room,
                    player: socket.data.user
                });

                // 广播房间列表更新
                broadcastRoomsUpdate(io);
            } catch (error) {
                console.error('加入房间错误:', error);
                socket.emit('error', { message: error instanceof Error ? error.message : '加入房间失败' });
            }
        });

        // 离开房间
        socket.on('leave_room', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                // 将socket离开房间频道
                socket.leave(data.roomId);

                // 通知房间内所有用户有玩家离开
                io.to(data.roomId).emit('player_left', {
                    room: await roomService.getRoomById(data.roomId) || { id: data.roomId, players: {}, status: GameStatus.WAITING },
                    playerId: socket.data.user.id
                });

                // 广播房间列表更新
                broadcastRoomsUpdate(io);
            } catch (error) {
                console.error('离开房间错误:', error);
                socket.emit('error', { message: '离开房间失败' });
            }
        });

        // 更新房间配置（主持人专用）
        socket.on('update_room_config', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const room = await roomService.getRoomById(data.roomId);

                if (!room) {
                    socket.emit('error', { message: '房间不存在' });
                    return;
                }

                if (room.hostId !== socket.data.user.id) {
                    socket.emit('error', { message: '只有主持人可以更新配置' });
                    return;
                }

                const updatedRoom = await roomService.updateRoomConfig(data.roomId, data.config);

                // 通知房间内所有用户配置已更新
                io.to(data.roomId).emit('game_updated', { room: updatedRoom });
            } catch (error) {
                console.error('更新配置错误:', error);
                socket.emit('error', { message: error instanceof Error ? error.message : '更新配置失败' });
            }
        });

        // 分配角色（主持人专用）
        socket.on('assign_roles', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const room = await roomService.getRoomById(data.roomId);

                if (!room) {
                    socket.emit('error', { message: '房间不存在' });
                    return;
                }

                if (room.hostId !== socket.data.user.id) {
                    socket.emit('error', { message: '只有主持人可以分配角色' });
                    return;
                }

                const updatedRoom = await roomService.assignRoles(data.roomId, data.assignments);

                // 通知房间内所有用户角色已分配
                io.to(data.roomId).emit('game_updated', { room: updatedRoom });
            } catch (error) {
                console.error('分配角色错误:', error);
                socket.emit('error', { message: error instanceof Error ? error.message : '分配角色失败' });
            }
        });

        // 开始游戏（主持人专用）
        socket.on('start_game', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const room = await roomService.getRoomById(data.roomId);

                if (!room) {
                    socket.emit('error', { message: '房间不存在' });
                    return;
                }

                if (room.hostId !== socket.data.user.id) {
                    socket.emit('error', { message: '只有主持人可以开始游戏' });
                    return;
                }

                const updatedRoom = await roomService.startGame(data.roomId);

                // 通知房间内所有用户游戏已开始
                io.to(data.roomId).emit('game_started', { room: updatedRoom });

                // 广播房间列表更新
                broadcastRoomsUpdate(io);
            } catch (error) {
                console.error('开始游戏错误:', error);
                socket.emit('error', { message: error instanceof Error ? error.message : '开始游戏失败' });
            }
        });

        // 开始投票（主持人专用）
        socket.on('start_vote', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const room = await roomService.getRoomById(data.roomId);

                if (!room) {
                    socket.emit('error', { message: '房间不存在' });
                    return;
                }

                if (room.hostId !== socket.data.user.id) {
                    socket.emit('error', { message: '只有主持人可以开始投票' });
                    return;
                }

                const updatedRoom = await roomService.startVote(data.roomId);

                // 通知房间内所有用户投票已开始
                io.to(data.roomId).emit('vote_started', { room: updatedRoom });
            } catch (error) {
                console.error('开始投票错误:', error);
                socket.emit('error', { message: error instanceof Error ? error.message : '开始投票失败' });
            }
        });

        // 结束投票（主持人专用）
        socket.on('end_vote', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const room = await roomService.getRoomById(data.roomId);

                if (!room) {
                    socket.emit('error', { message: '房间不存在' });
                    return;
                }

                if (room.hostId !== socket.data.user.id) {
                    socket.emit('error', { message: '只有主持人可以结束投票' });
                    return;
                }

                const result = await roomService.endVote(data.roomId);

                // 通知房间内所有用户投票已结束
                io.to(data.roomId).emit('vote_ended', {
                    room: result.room,
                    eliminated: result.eliminated
                });

                // 如果游戏结束，通知房间内所有玩家
                if (result.gameOver) {
                    io.to(data.roomId).emit('game_ended', {
                        room: result.room,
                        winners: result.winners || []
                    });
                }
            } catch (error) {
                console.error('结束投票错误:', error);
                socket.emit('error', { message: error instanceof Error ? error.message : '结束投票失败' });
            }
        });

        // 玩家投票
        socket.on('vote', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const result = await roomService.vote(data.roomId, socket.data.user.id, data.targetId);

                // 通知房间内所有用户投票已更新
                io.to(data.roomId).emit('vote_updated', {
                    room: result.room,
                    votes: result.votes
                });
            } catch (error) {
                console.error('投票错误:', error);
                socket.emit('error', { message: error instanceof Error ? error.message : '投票失败' });
            }
        });

        // 猜词
        socket.on('guess_word', async (data) => {
            try {
                if (!socket.data.user) {
                    socket.emit('error', { message: '请先认证' });
                    return;
                }

                const result = await roomService.guessWord(data.roomId, socket.data.user.id, data.word);

                // 通知房间内所有用户游戏状态已更新
                io.to(data.roomId).emit('game_updated', {
                    room: await roomService.getRoomById(data.roomId) as any
                });

                // 如果游戏结束，通知房间内所有玩家
                if (result.gameOver) {
                    io.to(data.roomId).emit('game_ended', {
                        room: await roomService.getRoomById(data.roomId) as any,
                        winners: result.winners || []
                    });
                }
            } catch (error) {
                console.error('猜词错误:', error);
                socket.emit('error', { message: error instanceof Error ? error.message : '猜词失败' });
            }
        });

        // 处理断开连接
        socket.on('disconnect', () => {
            console.log(`用户已断开连接: ${socket.id}`);

            // 如果是已认证用户，从映射中移除
            if (socket.data.user) {
                userSockets.delete(socket.data.user.id);
            }
        });
    });
}

// 广播房间列表更新
async function broadcastRoomsUpdate(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    try {
        const rooms = await roomService.getAllRooms();
        io.emit('rooms_update', { rooms });
    } catch (error) {
        console.error('广播房间列表错误:', error);
    }
}