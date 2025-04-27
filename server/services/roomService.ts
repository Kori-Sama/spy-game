import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/database';
import { GameRoom, GameStatus, Player, PlayerRole, RoomConfig, User } from '../../shared/types';
import * as userService from './userService';

// 创建新房间
export async function createRoom(hostId: string): Promise<GameRoom> {
    const db = getDB();
    const roomId = generateRoomId();

    await db.run(
        'INSERT INTO rooms (id, host_id, status) VALUES (?, ?, ?)',
        roomId, hostId, GameStatus.WAITING
    );

    // 将主持人添加到房间中
    await db.run(
        'INSERT INTO players (user_id, room_id) VALUES (?, ?)',
        hostId, roomId
    );

    const host = await userService.getUserById(hostId);

    if (!host) {
        throw new Error('主持人不存在');
    }

    const room: GameRoom = {
        id: roomId,
        players: {
            [hostId]: {
                ...host,
                role: PlayerRole.GOOD, // 默认为好人，但主持人不参与游戏
                isHost: true,
                isAlive: true,
                votedBy: []
            }
        },
        status: GameStatus.WAITING,
        hostId
    };

    return room;
}

// 生成6位数字的房间ID
function generateRoomId(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 获取房间信息
export async function getRoomById(roomId: string): Promise<GameRoom | null> {
    const db = getDB();

    const room = await db.get('SELECT * FROM rooms WHERE id = ?', roomId);

    if (!room) {
        return null;
    }

    // 获取房间内的玩家
    const players = await db.all(`
    SELECT p.user_id, p.role, p.is_alive, u.username
    FROM players p
    JOIN users u ON p.user_id = u.id
    WHERE p.room_id = ?
  `, roomId);

    const playersMap: Record<string, Player> = {};

    for (const p of players) {
        playersMap[p.user_id] = {
            id: p.user_id,
            username: p.username,
            role: p.role || PlayerRole.GOOD, // 默认为好人
            isHost: p.user_id === room.host_id,
            isAlive: Boolean(p.is_alive),
            votedBy: []
        };
    }

    return {
        id: roomId,
        players: playersMap,
        status: room.status as GameStatus,
        hostId: room.host_id,
        config: room.good_word && room.bad_word ? {
            goodWord: room.good_word,
            badWord: room.bad_word,
            goodCount: Object.values(playersMap).filter(p => p.role === PlayerRole.GOOD && !p.isHost).length,
            badCount: Object.values(playersMap).filter(p => p.role === PlayerRole.BAD).length,
            blankCount: Object.values(playersMap).filter(p => p.role === PlayerRole.BLANK).length
        } : undefined
    };
}

// 获取所有房间
export async function getAllRooms(): Promise<GameRoom[]> {
    const db = getDB();

    const rooms = await db.all('SELECT id FROM rooms WHERE status != ?', GameStatus.ENDED);

    const result: GameRoom[] = [];

    for (const room of rooms) {
        const fullRoom = await getRoomById(room.id);
        if (fullRoom) {
            result.push(fullRoom);
        }
    }

    return result;
}

// 加入房间
export async function joinRoom(roomId: string, userId: string): Promise<GameRoom> {
    const db = getDB();

    // 检查房间是否存在
    const room = await getRoomById(roomId);

    if (!room) {
        throw new Error('房间不存在');
    }

    if (room.status !== GameStatus.WAITING) {
        throw new Error('游戏已经开始，无法加入');
    }

    // 检查用户是否已经在房间中
    const playerExists = await db.get(
        'SELECT 1 FROM players WHERE user_id = ? AND room_id = ?',
        userId, roomId
    );

    if (!playerExists) {
        // 将用户添加到房间
        await db.run(
            'INSERT INTO players (user_id, room_id) VALUES (?, ?)',
            userId, roomId
        );
    }

    // 返回更新后的房间信息
    return getRoomById(roomId) as Promise<GameRoom>;
}

// 更新房间配置
export async function updateRoomConfig(roomId: string, config: Partial<RoomConfig>): Promise<GameRoom> {
    const db = getDB();

    const room = await getRoomById(roomId);

    if (!room) {
        throw new Error('房间不存在');
    }

    if (room.status !== GameStatus.WAITING) {
        throw new Error('游戏已经开始，无法修改配置');
    }

    // 更新好人词和坏人词
    if (config.goodWord || config.badWord) {
        await db.run(
            'UPDATE rooms SET good_word = COALESCE(?, good_word), bad_word = COALESCE(?, bad_word) WHERE id = ?',
            config.goodWord, config.badWord, roomId
        );
    }

    // 返回更新后的房间信息
    return getRoomById(roomId) as Promise<GameRoom>;
}

// 分配角色
export async function assignRoles(
    roomId: string,
    assignments?: Record<string, PlayerRole>
): Promise<GameRoom> {
    const db = getDB();

    const room = await getRoomById(roomId);

    if (!room) {
        throw new Error('房间不存在');
    }

    if (room.status !== GameStatus.WAITING) {
        throw new Error('游戏已经开始，无法修改角色');
    }

    if (!room.config) {
        throw new Error('请先设置游戏配置');
    }

    const players = Object.values(room.players);
    const nonHostPlayers = players.filter(p => !p.isHost);

    // 如果没有提供指定分配，则随机分配
    if (!assignments) {
        const { goodCount, badCount, blankCount } = room.config;

        // 验证总人数是否符合配置
        if (goodCount + badCount + blankCount !== nonHostPlayers.length) {
            throw new Error('角色数量与玩家数量不匹配');
        }

        // 创建角色数组
        const roles: PlayerRole[] = [
            ...Array(goodCount).fill(PlayerRole.GOOD),
            ...Array(badCount).fill(PlayerRole.BAD),
            ...Array(blankCount).fill(PlayerRole.BLANK)
        ];

        // 随机打乱角色
        shuffleArray(roles);

        // 分配角色
        let index = 0;
        assignments = {};

        for (const player of nonHostPlayers) {
            assignments[player.id] = roles[index++];
        }
    }

    // 更新数据库中的角色
    for (const [userId, role] of Object.entries(assignments)) {
        await db.run(
            'UPDATE players SET role = ? WHERE user_id = ? AND room_id = ?',
            role, userId, roomId
        );
    }

    // 返回更新后的房间信息
    return getRoomById(roomId) as Promise<GameRoom>;
}

// 开始游戏
export async function startGame(roomId: string): Promise<GameRoom> {
    const db = getDB();

    const room = await getRoomById(roomId);

    if (!room) {
        throw new Error('房间不存在');
    }

    if (room.status !== GameStatus.WAITING) {
        throw new Error('游戏已经开始');
    }

    if (!room.config) {
        throw new Error('请先设置游戏配置');
    }

    // 检查所有玩家是否都有角色
    const players = Object.values(room.players).filter(p => !p.isHost);
    if (players.some(p => !p.role)) {
        throw new Error('有玩家未分配角色');
    }

    // 更新房间状态为游戏中
    await db.run(
        'UPDATE rooms SET status = ? WHERE id = ?',
        GameStatus.PLAYING, roomId
    );

    // 返回更新后的房间信息
    return getRoomById(roomId) as Promise<GameRoom>;
}

// 开始投票
export async function startVote(roomId: string): Promise<GameRoom> {
    const db = getDB();

    const room = await getRoomById(roomId);

    if (!room) {
        throw new Error('房间不存在');
    }

    if (room.status !== GameStatus.PLAYING) {
        throw new Error('游戏未在进行中');
    }

    // 更新房间状态为投票中
    await db.run(
        'UPDATE rooms SET status = ? WHERE id = ?',
        GameStatus.VOTING, roomId
    );

    // 返回更新后的房间信息
    return getRoomById(roomId) as Promise<GameRoom>;
}

// 玩家投票
export async function vote(
    roomId: string,
    voterId: string,
    targetId: string
): Promise<{ room: GameRoom, votes: Record<string, string> }> {
    const room = await getRoomById(roomId);

    if (!room) {
        throw new Error('房间不存在');
    }

    if (room.status !== GameStatus.VOTING) {
        throw new Error('当前不是投票阶段');
    }

    // 检查投票者和目标是否都存在且存活
    const voter = room.players[voterId];
    const target = room.players[targetId];

    if (!voter || !voter.isAlive) {
        throw new Error('投票者不存在或已死亡');
    }

    if (!target || !target.isAlive) {
        throw new Error('投票目标不存在或已死亡');
    }

    // 记录投票
    voter.voted = targetId;
    if (!target.votedBy) target.votedBy = [];
    target.votedBy.push(voterId);

    // 收集所有投票
    const votes: Record<string, string> = {};
    for (const player of Object.values(room.players)) {
        if (player.voted) {
            votes[player.id] = player.voted;
        }
    }

    return { room, votes };
}

// 结束投票
export async function endVote(
    roomId: string
): Promise<{ room: GameRoom, eliminated?: string, gameOver?: boolean, winners?: PlayerRole[] }> {
    const db = getDB();

    const room = await getRoomById(roomId);

    if (!room) {
        throw new Error('房间不存在');
    }

    if (room.status !== GameStatus.VOTING) {
        throw new Error('当前不是投票阶段');
    }

    // 统计投票
    const voteCounts = new Map<string, number>();
    const livingPlayers = Object.values(room.players).filter(p => p.isAlive && !p.isHost);

    for (const player of livingPlayers) {
        if (player.votedBy && player.votedBy.length > 0) {
            voteCounts.set(player.id, player.votedBy.length);
        }
    }

    let eliminated: string | undefined;
    let maxVotes = 0;

    // 找出得票最多的玩家
    for (const [playerId, votes] of voteCounts.entries()) {
        if (votes > maxVotes) {
            maxVotes = votes;
            eliminated = playerId;
        } else if (votes === maxVotes) {
            // 如果有平票，则没有人被淘汰
            eliminated = undefined;
        }
    }

    // 检查是否达到半数
    const halfCount = Math.ceil(livingPlayers.length / 2);
    if (maxVotes < halfCount) {
        eliminated = undefined;
    }

    // 如果有人被淘汰，更新其状态
    if (eliminated) {
        await db.run(
            'UPDATE players SET is_alive = 0 WHERE user_id = ? AND room_id = ?',
            eliminated, roomId
        );

        // 更新内存中的状态
        if (room.players[eliminated]) {
            room.players[eliminated].isAlive = false;
        }
    }

    // 清空投票记录
    for (const player of Object.values(room.players)) {
        player.voted = undefined;
        player.votedBy = [];
    }

    // 检查游戏是否结束
    const { gameOver, winners } = checkGameOver(room);

    // 更新游戏状态
    if (gameOver) {
        await db.run(
            'UPDATE rooms SET status = ? WHERE id = ?',
            GameStatus.ENDED, roomId
        );
        room.status = GameStatus.ENDED;
        room.winners = winners;
    } else {
        // 恢复为游戏中状态
        await db.run(
            'UPDATE rooms SET status = ? WHERE id = ?',
            GameStatus.PLAYING, roomId
        );
        room.status = GameStatus.PLAYING;
    }

    return { room, eliminated, gameOver, winners };
}

// 猜词
export async function guessWord(
    roomId: string,
    playerId: string,
    word: string
): Promise<{ correct: boolean, gameOver: boolean, winners?: PlayerRole[] }> {
    const db = getDB();

    const room = await getRoomById(roomId);

    if (!room) {
        throw new Error('房间不存在');
    }

    if (room.status !== GameStatus.PLAYING) {
        throw new Error('游戏未在进行中');
    }

    if (!room.config) {
        throw new Error('游戏配置不存在');
    }

    const player = room.players[playerId];

    if (!player || !player.isAlive) {
        throw new Error('玩家不存在或已死亡');
    }

    let correct = false;

    // 根据玩家角色和猜测词决定结果
    if (player.role === PlayerRole.BAD) {
        // 坏人猜好人词
        correct = word === room.config.goodWord;
    } else if (player.role === PlayerRole.BLANK) {
        // 白板猜好人词
        correct = word === room.config.goodWord;
    } else if (player.role === PlayerRole.GOOD) {
        // 好人猜词直接死亡
        correct = false;
    }

    // 更新玩家状态
    if (player.role === PlayerRole.GOOD || !correct) {
        // 好人猜词或猜错都死亡
        await db.run(
            'UPDATE players SET is_alive = 0 WHERE user_id = ? AND room_id = ?',
            playerId, roomId
        );
        player.isAlive = false;
    }

    // 检查游戏是否结束
    const { gameOver, winners } = checkGameOver(room);

    // 如果游戏结束，更新游戏状态
    if (gameOver || correct) {
        await db.run(
            'UPDATE rooms SET status = ? WHERE id = ?',
            GameStatus.ENDED, roomId
        );
        room.status = GameStatus.ENDED;
        room.winners = winners || (correct ? [player.role] : undefined);
    }

    return { correct, gameOver: gameOver || correct, winners: winners || (correct ? [player.role] : undefined) };
}

// 检查游戏是否结束
function checkGameOver(room: GameRoom): { gameOver: boolean, winners?: PlayerRole[] } {
    const livingPlayers = Object.values(room.players).filter(p => p.isAlive && !p.isHost);

    // 统计不同角色的存活人数
    const livingGood = livingPlayers.filter(p => p.role === PlayerRole.GOOD).length;
    const livingBad = livingPlayers.filter(p => p.role === PlayerRole.BAD).length;
    const livingBlank = livingPlayers.filter(p => p.role === PlayerRole.BLANK).length;

    // 检查游戏是否结束
    if (livingBad === 0 && livingBlank === 0) {
        // 坏人和白板都已出局，好人胜利
        return { gameOver: true, winners: [PlayerRole.GOOD] };
    }

    if (livingGood <= livingBad) {
        // 好人数量小于等于坏人数量，坏人胜利
        return { gameOver: true, winners: [PlayerRole.BAD] };
    }

    // 游戏继续
    return { gameOver: false };
}

// 工具函数：随机打乱数组
function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}