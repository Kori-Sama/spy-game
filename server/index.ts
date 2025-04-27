import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDatabase } from './db/database';
import { ClientToServerEvents, ServerToClientEvents } from '../shared/types';
import * as userService from './services/userService';
import * as roomService from './services/roomService';
import { initSocketService } from './services/socketService';

// 初始化Koa应用
const app = new Koa();
const router = new Router();

// 创建HTTP服务器和Socket.IO实例
const httpServer = createServer(app.callback());
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*",  // 开发环境允许所有来源
    methods: ["GET", "POST"]
  }
});

// 初始化数据库
async function init() {
  try {
    await initDatabase();
    console.log('数据库初始化成功');

    // 初始化Socket.IO服务
    initSocketService(io);

  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

// 中间件
app.use(cors());
app.use(bodyParser());

// REST API路由
router.post('/api/register', async (ctx) => {
  const { username } = ctx.request.body as { username: string };

  if (!username) {
    ctx.status = 400;
    ctx.body = { success: false, message: '用户名不能为空' };
    return;
  }

  try {
    const user = await userService.createUser(username);

    ctx.body = {
      success: true,
      user
    };
  } catch (error) {
    console.error('注册用户错误:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '注册用户失败' };
  }
});

router.get('/api/users', async (ctx) => {
  try {
    const users = await userService.getAllUsers();

    ctx.body = {
      success: true,
      users
    };
  } catch (error) {
    console.error('获取用户列表错误:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取用户列表失败' };
  }
});

router.get('/api/rooms', async (ctx) => {
  try {
    const rooms = await roomService.getAllRooms();

    ctx.body = {
      success: true,
      rooms
    };
  } catch (error) {
    console.error('获取房间列表错误:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取房间列表失败' };
  }
});

router.get('/api/rooms/:roomId', async (ctx) => {
  try {
    const { roomId } = ctx.params;
    const room = await roomService.getRoomById(roomId);

    if (!room) {
      ctx.status = 404;
      ctx.body = { success: false, message: '房间不存在' };
      return;
    }

    ctx.body = {
      success: true,
      room
    };
  } catch (error) {
    console.error('获取房间详情错误:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: '获取房间详情失败' };
  }
});

// 应用路由中间件
app.use(router.routes()).use(router.allowedMethods());

// 启动服务器
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);

  // 初始化
  init();
});