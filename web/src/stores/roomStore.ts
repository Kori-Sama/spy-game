import { create } from "zustand";
import { GameRoom, PlayerRole, RoomConfig } from "../../../shared/types";
import { useSocketStore } from "./socketStore";
import axios from "axios";
import { API_URL } from "./constant";

// Add a flag to track if events are already set up
let eventsSetup = false;

// Add a flag to track if joining is in progress
let joiningRoom = false;

interface RoomState {
  rooms: GameRoom[];
  currentRoom: GameRoom | null;
  votes: Record<string, string>;

  // 房间管理
  fetchRooms: () => Promise<void>;
  createRoom: () => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  setCurrentRoom: (room: GameRoom | null) => void;

  // 主持人操作
  updateRoomConfig: (
    roomId: string,
    config: Partial<RoomConfig>
  ) => Promise<void>;
  assignRoles: (
    roomId: string,
    assignments?: Record<string, PlayerRole>
  ) => Promise<void>;
  startGame: (roomId: string) => Promise<void>;
  startVote: (roomId: string) => Promise<void>;
  endVote: (roomId: string) => Promise<void>;
  removePlayer: (roomId: string, playerId: string) => Promise<void>; // 添加踢人方法

  // 玩家操作
  vote: (roomId: string, targetId: string) => Promise<void>;
  guessWord: (roomId: string, word: string) => Promise<void>;

  // 事件处理
  setupRoomEvents: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  currentRoom: null,
  votes: {},

  fetchRooms: async () => {
    try {
      const response = await axios.get(`${API_URL}/api/rooms`);
      set({ rooms: response.data.rooms || [] });
    } catch (error) {
      console.error("获取房间列表失败:", error);
    }
  },

  createRoom: async () => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    return new Promise<string>((resolve, reject) => {
      socket.emit("create_room");

      socket.once("room_created", (data) => {
        set({ currentRoom: data.room });
        resolve(data.roomId);
      });

      // 5秒超时
      setTimeout(() => reject(new Error("创建房间超时")), 5000);
    });
  },

  joinRoom: async (roomId) => {
    // If already joining a room, prevent duplicate requests
    if (joiningRoom) return Promise.resolve();

    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    try {
      joiningRoom = true;

      return new Promise<void>((resolve, reject) => {
        socket.emit("join_room", { roomId });

        socket.once("room_joined", (data) => {
          console.log("房间加入成功", data);
          set({ currentRoom: data.room });
          resolve();
        });

        // 5秒超时
        setTimeout(() => reject(new Error("加入房间超时")), 5000);
      });
    } finally {
      // Reset flag when done
      joiningRoom = false;
    }
  },

  leaveRoom: async (roomId) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("leave_room", { roomId });
    set({ currentRoom: null });

    return Promise.resolve();
  },

  setCurrentRoom: (room) => {
    set({ currentRoom: room });
  },

  updateRoomConfig: async (roomId, config) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("update_room_config", { roomId, config });
  },

  assignRoles: async (roomId, assignments) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("assign_roles", { roomId, assignments });
  },

  startGame: async (roomId) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("start_game", { roomId });
  },

  startVote: async (roomId) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("start_vote", { roomId });
  },

  endVote: async (roomId) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("end_vote", { roomId });
  },

  removePlayer: async (roomId, playerId) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("remove_player", { roomId, playerId });
  },

  vote: async (roomId, targetId) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("vote", { roomId, targetId });
  },

  guessWord: async (roomId, word) => {
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      throw new Error("Socket未连接");
    }

    socket.emit("guess_word", { roomId, word });
  },

  setupRoomEvents: () => {
    // If events are already set up, don't set them up again
    if (eventsSetup) return;

    const socket = useSocketStore.getState().socket;

    if (!socket) {
      return;
    }

    // 房间列表更新
    socket.on("rooms_update", (data) => {
      set({ rooms: data.rooms || [] });
    });

    // 房间内玩家更新
    socket.on("player_joined", (data) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === data.room.id) {
        set({ currentRoom: data.room });
      }
    });

    socket.on("player_left", (data) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === data.room.id) {
        set({ currentRoom: data.room });
      }
    });

    // 游戏状态更新
    socket.on("game_updated", (data) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === data.room.id) {
        set({ currentRoom: data.room });
      }
    });

    socket.on("game_started", (data) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === data.room.id) {
        set({ currentRoom: data.room });
      }
    });

    socket.on("game_ended", (data) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === data.room.id) {
        set({ currentRoom: data.room });
      }
    });

    // 投票状态更新
    socket.on("vote_started", (data) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === data.room.id) {
        set({ currentRoom: data.room });
      }
    });

    socket.on("vote_updated", (data) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === data.room.id) {
        set({
          currentRoom: data.room,
          votes: data.votes || {},
        });
      }
    });

    socket.on("vote_ended", (data) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === data.room.id) {
        set({
          currentRoom: data.room,
          votes: {},
        });
      }
    });

    // Mark events as set up
    eventsSetup = true;
  },
}));
