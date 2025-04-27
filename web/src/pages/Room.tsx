import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, NavBar, Form, Input, Stepper, Toast } from "antd-mobile";
import { useUserStore } from "../stores/userStore";
import { useRoomStore } from "../stores/roomStore";
import { GameStatus } from "../../../shared/types";

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const {
    currentRoom,
    joinRoom,
    leaveRoom,
    setupRoomEvents,
    updateRoomConfig,
    assignRoles,
    startGame,
  } = useRoomStore();

  //   console.log("当前房间信息:", currentRoom);

  const [loading, setLoading] = useState(false);
  const [configForm, setConfigForm] = useState({
    goodWord: "",
    badWord: "",
    goodCount: 2,
    badCount: 1,
    blankCount: 0,
    maxPlayers: 4, // 默认最大人数为10
  });

  // 当前用户是否为房主
  const isHost = currentRoom?.hostId === user?.id;

  useEffect(() => {
    // 确保设置Socket事件监听
    setupRoomEvents();

    // 如果房间ID存在但当前没有房间信息，则加入房间
    if (roomId && !currentRoom) {
      joinRoom(roomId).catch((error) => {
        console.error("加入房间失败:", error);
        Toast.show({
          content: error instanceof Error ? error.message : "加入房间失败",
          position: "bottom",
        });
        // 加入失败则返回主页
        navigate("/home");
      });
    }
  }, [currentRoom, joinRoom, leaveRoom, navigate, roomId, setupRoomEvents]);

  // 监听房间状态变化，如果游戏开始则跳转到游戏页面
  useEffect(() => {
    if (
      currentRoom &&
      (currentRoom.status === GameStatus.PLAYING ||
        currentRoom.status === GameStatus.VOTING)
    ) {
      const gameUrl = `/game/${currentRoom.id}`;
      if (window.location.pathname !== gameUrl) {
        navigate(gameUrl);
      }
    }
  }, [currentRoom, navigate]);

  // 初始化配置表单
  useEffect(() => {
    if (currentRoom?.config) {
      setConfigForm({
        goodWord: currentRoom.config.goodWord || "",
        badWord: currentRoom.config.badWord || "",
        goodCount: currentRoom.config.goodCount || 0,
        badCount: currentRoom.config.badCount || 0,
        blankCount: currentRoom.config.blankCount || 0,
        maxPlayers: currentRoom.config.maxPlayers || 4,
      });
    } else if (currentRoom && isHost) {
      // 如果是房主且没有配置，则设置默认值
      const playerCount = currentRoom.config?.maxPlayers ?? 4;
      setConfigForm({
        goodWord: "",
        badWord: "",
        goodCount: Math.max(Math.floor(playerCount * 0.7), 1),
        badCount: Math.max(Math.floor(playerCount * 0.2), 1),
        blankCount: Math.max(
          playerCount -
            Math.floor(playerCount * 0.7) -
            Math.floor(playerCount * 0.2),
          0
        ),
        maxPlayers: 4,
      });
    }
  }, [currentRoom, isHost]);

  const handleLeaveRoom = async () => {
    try {
      setLoading(true);
      if (roomId) {
        await leaveRoom(roomId);
      }
      navigate("/home");
    } catch (error) {
      console.error("离开房间失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    if (!roomId || !isHost) return;

    // 验证输入
    if (!configForm.goodWord.trim() || !configForm.badWord.trim()) {
      Toast.show({
        content: "好人词和坏人词不能为空",
        position: "bottom",
      });
      return;
    }

    const playerCount = configForm.maxPlayers;
    if (
      configForm.goodCount + configForm.badCount + configForm.blankCount !==
      playerCount
    ) {
      Toast.show({
        content: `角色数量(${
          configForm.goodCount + configForm.badCount + configForm.blankCount
        })与玩家数量(${playerCount})不一致`,
        position: "bottom",
      });
      return;
    }

    try {
      setLoading(true);
      await updateRoomConfig(roomId, {
        goodWord: configForm.goodWord.trim(),
        badWord: configForm.badWord.trim(),
        goodCount: configForm.goodCount,
        badCount: configForm.badCount,
        blankCount: configForm.blankCount,
        maxPlayers: configForm.maxPlayers,
      });

      Toast.show({
        content: "配置更新成功",
        position: "bottom",
      });
    } catch (error) {
      console.error("更新配置失败:", error);
      Toast.show({
        content: "更新配置失败",
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRandomAssignRoles = async () => {
    if (!roomId || !isHost) return;

    try {
      setLoading(true);
      await assignRoles(roomId);

      Toast.show({
        content: "角色分配成功",
        position: "bottom",
      });
    } catch (error) {
      console.error("角色分配失败:", error);
      Toast.show({
        content: error instanceof Error ? error.message : "角色分配失败",
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!roomId || !isHost) return;

    try {
      setLoading(true);
      await startGame(roomId);
    } catch (error) {
      console.error("开始游戏失败:", error);
      Toast.show({
        content: error instanceof Error ? error.message : "开始游戏失败",
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentRoom) {
    return (
      <div className="page-container">
        <div className="card">正在加载房间信息...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <NavBar
        onBack={handleLeaveRoom}
        right={
          isHost ? null : (
            <Button size="small" onClick={handleLeaveRoom}>
              退出
            </Button>
          )
        }
      >
        房间号: {roomId}
      </NavBar>

      <div className="card">
        <h2>玩家列表 ({Object.keys(currentRoom.players).length})</h2>
        <div className="player-list">
          {Object.values(currentRoom.players).map((player) => (
            <div
              key={player.id}
              className={`player-item ${player.isHost ? "host" : ""}`}
            >
              {player.username}
              {player.isHost && (
                <div
                  style={{ fontSize: "12px", color: "var(--primary-color)" }}
                >
                  (主持人)
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="card">
          <h2>游戏设置</h2>
          <Form layout="horizontal" style={{ marginTop: "16px" }}>
            <Form.Item label="好人词">
              <Input
                placeholder="请输入好人词"
                value={configForm.goodWord}
                onChange={(val) =>
                  setConfigForm((prev) => ({ ...prev, goodWord: val }))
                }
              />
            </Form.Item>
            <Form.Item label="坏人词">
              <Input
                placeholder="请输入坏人词"
                value={configForm.badWord}
                onChange={(val) =>
                  setConfigForm((prev) => ({ ...prev, badWord: val }))
                }
              />
            </Form.Item>
            <Form.Item label="好人数量">
              <Stepper
                min={1}
                value={configForm.goodCount}
                onChange={(val) =>
                  setConfigForm((prev) => ({ ...prev, goodCount: val }))
                }
              />
            </Form.Item>
            <Form.Item label="坏人数量">
              <Stepper
                min={1}
                value={configForm.badCount}
                onChange={(val) =>
                  setConfigForm((prev) => ({ ...prev, badCount: val }))
                }
              />
            </Form.Item>
            <Form.Item label="白板数量">
              <Stepper
                min={0}
                value={configForm.blankCount}
                onChange={(val) =>
                  setConfigForm((prev) => ({ ...prev, blankCount: val }))
                }
              />
            </Form.Item>
            <Form.Item label="最大玩家数量">
              <Stepper
                min={1}
                value={configForm.maxPlayers}
                onChange={(val) =>
                  setConfigForm((prev) => ({ ...prev, maxPlayers: val }))
                }
              />
            </Form.Item>
          </Form>

          <div className="button-group" style={{ justifyContent: "flex-end" }}>
            <Button
              color="primary"
              onClick={handleUpdateConfig}
              loading={loading}
              disabled={loading}
            >
              保存配置
            </Button>
          </div>
        </div>
      )}

      {isHost && (
        <div className="card">
          <h2>开始游戏</h2>
          <p>确保游戏配置正确，然后分配角色并开始游戏。</p>

          <div
            className="button-group"
            style={{ justifyContent: "space-between" }}
          >
            <Button
              onClick={handleRandomAssignRoles}
              loading={loading}
              disabled={
                loading ||
                !currentRoom.config?.goodWord ||
                !currentRoom.config?.badWord
              }
            >
              随机分配角色
            </Button>
            <Button
              color="primary"
              onClick={handleStartGame}
              loading={loading}
              disabled={
                loading ||
                !currentRoom.config?.goodWord ||
                !currentRoom.config?.badWord ||
                Object.values(currentRoom.players).some(
                  (p) => p.role === undefined && !p.isHost
                )
              }
            >
              开始游戏
            </Button>
          </div>
        </div>
      )}

      {!isHost && (
        <div className="card">
          <h2>等待游戏开始</h2>
          <p>主持人正在配置游戏，请耐心等待...</p>
        </div>
      )}
    </div>
  );
};

export default Room;
