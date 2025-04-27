import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/database';
import { User } from '../../shared/types';

// 创建用户
export async function createUser(username: string): Promise<User> {
    const db = getDB();
    const userId = uuidv4();

    await db.run('INSERT INTO users (id, username) VALUES (?, ?)', userId, username);

    return {
        id: userId,
        username
    };
}

// 根据ID获取用户
export async function getUserById(userId: string): Promise<User | null> {
    const db = getDB();
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', userId);
    return user || null;
}

// 获取所有用户
export async function getAllUsers(): Promise<User[]> {
    const db = getDB();
    return await db.all('SELECT id, username FROM users');
}

// 根据房间ID获取所有用户
export async function getUsersByRoomId(roomId: string): Promise<User[]> {
    const db = getDB();
    const users = await db.all(`
    SELECT u.id, u.username 
    FROM users u
    JOIN players p ON u.id = p.user_id
    WHERE p.room_id = ?
  `, roomId);
    return users;
}