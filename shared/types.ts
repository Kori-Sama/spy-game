// 玩家角色类型
export enum PlayerRole {
  GOOD = "good", // 好人
  BAD = "bad", // 坏人
  BLANK = "blank", // 白板
}

// 游戏状态
export enum GameStatus {
  WAITING = "waiting", // 等待开始
  PLAYING = "playing", // 游戏中
  VOTING = "voting", // 投票中
  ENDED = "ended", // 游戏结束
}

// 用户信息
export interface User {
  id: string;
  username: string;
}

// 玩家信息（含角色）
export interface Player extends User {
  role: PlayerRole;
  isHost: boolean; // 是否为主持人
  isAlive: boolean; // 是否存活
  voted?: string; // 投给了谁
  votedBy: string[]; // 被谁投票
}

// 房间配置
export interface RoomConfig {
  goodCount: number; // 好人数量
  badCount: number; // 坏人数量
  blankCount: number; // 白板数量
  goodWord: string; // 好人词
  badWord: string; // 坏人词
  maxPlayers: number; // 房间人数上限
}

// 游戏房间
export interface GameRoom {
  id: string;
  players: Record<string, Player>;
  status: GameStatus;
  config?: RoomConfig;
  hostId?: string; // 主持人ID
  winners?: PlayerRole[]; // 获胜者
}

// Socket.IO 事件类型
export interface ServerToClientEvents {
  // 房间事件
  room_created: (data: { roomId: string; room: GameRoom }) => void;
  room_joined: (data: { room: GameRoom }) => void;
  rooms_update: (data: { rooms: GameRoom[] }) => void;
  player_joined: (data: { room: GameRoom; player: User }) => void;
  player_left: (data: { room: GameRoom; playerId: string }) => void;

  // 游戏事件
  game_started: (data: { room: GameRoom }) => void;
  game_updated: (data: { room: GameRoom }) => void;
  game_ended: (data: { room: GameRoom; winners: PlayerRole[] }) => void;

  // 投票事件
  vote_started: (data: { room: GameRoom }) => void;
  vote_updated: (data: {
    room: GameRoom;
    votes: Record<string, string>;
  }) => void;
  vote_ended: (data: { room: GameRoom; eliminated?: string }) => void;

  // 错误事件
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  // 认证事件
  authenticate: (data: { userId: string }) => void;

  // 房间事件
  create_room: () => void;
  join_room: (data: { roomId: string }) => void;
  leave_room: (data: { roomId: string }) => void;

  // 主持人操作
  update_room_config: (data: {
    roomId: string;
    config: Partial<RoomConfig>;
  }) => void;
  assign_roles: (data: {
    roomId: string;
    assignments?: Record<string, PlayerRole>;
  }) => void; // 为空则随机分配
  start_game: (data: { roomId: string }) => void;
  start_vote: (data: { roomId: string }) => void;
  end_vote: (data: { roomId: string }) => void;

  // 玩家操作
  vote: (data: { roomId: string; targetId: string }) => void;
  guess_word: (data: { roomId: string; word: string }) => void;

  remove_player: (data: { roomId: string; playerId: string }) => void; // 主持人踢人
}
