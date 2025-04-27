import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  NavBar,
  Dialog,
  Toast,
  Form,
  Input,
  Space,
  Radio,
} from "antd-mobile";
import { useUserStore } from "../stores/userStore";
import { useRoomStore } from "../stores/roomStore";
import { GameStatus, PlayerRole } from "../../../shared/types";

const Game = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const {
    currentRoom,
    joinRoom,
    leaveRoom,
    setupRoomEvents,
    vote,
    guessWord,
    startVote,
    endVote,
    removePlayer,
  } = useRoomStore();

  const [loading, setLoading] = useState(false);
  const [guessWordInput, setGuessWordInput] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");

  // 当前用户是否为主持人
  const isHost = currentRoom?.hostId === user?.id;

  // 获取当前用户在游戏中的信息
  const currentPlayer = user?.id ? currentRoom?.players[user.id] : undefined;

  // 游戏阶段
  const isPlaying = currentRoom?.status === GameStatus.PLAYING;
  const isVoting = currentRoom?.status === GameStatus.VOTING;
  const isEnded = currentRoom?.status === GameStatus.ENDED;

  // 当前用户是否存活
  const isAlive = currentPlayer?.isAlive ?? false;

  // 玩家角色
  const playerRole = currentPlayer?.role;

  // 玩家需要知道的词
  const playerWord =
    playerRole === PlayerRole.GOOD
      ? currentRoom?.config?.goodWord
      : playerRole === PlayerRole.BAD
      ? currentRoom?.config?.badWord
      : "";

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
  }, [roomId, currentRoom, joinRoom, setupRoomEvents, navigate]);

  // 监听房间状态变化，如果游戏回到等待状态，则跳转到房间页面
  useEffect(() => {
    if (currentRoom?.status === GameStatus.WAITING) {
      const roomUrl = `/room/${roomId}`;
      if (window.location.pathname !== roomUrl) {
        navigate(roomUrl);
      }
    }
  }, [currentRoom?.status, navigate, roomId]);

  const handleBackToLobby = () => {
    Dialog.confirm({
      title: "返回大厅",
      content: "确定要返回游戏大厅吗？",
      confirmText: "确定",
      cancelText: "取消",
      onConfirm: async () => {
        try {
          setLoading(true);
          if (roomId) {
            await leaveRoom(roomId);
          }
          navigate("/home");
        } catch (error) {
          console.error("返回大厅失败:", error);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleStartVote = async () => {
    if (!roomId || !isHost) return;

    try {
      setLoading(true);
      await startVote(roomId);

      Toast.show({
        content: "投票已开始",
        position: "bottom",
      });
    } catch (error) {
      console.error("开始投票失败:", error);
      Toast.show({
        content: error instanceof Error ? error.message : "开始投票失败",
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEndVote = async () => {
    if (!roomId || !isHost) return;

    try {
      setLoading(true);
      await endVote(roomId);

      Toast.show({
        content: "投票已结束",
        position: "bottom",
      });
    } catch (error) {
      console.error("结束投票失败:", error);
      Toast.show({
        content: error instanceof Error ? error.message : "结束投票失败",
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!roomId || !selectedPlayerId) return;

    try {
      setLoading(true);
      await vote(roomId, selectedPlayerId);

      Toast.show({
        content: "投票成功",
        position: "bottom",
      });
    } catch (error) {
      console.error("投票失败:", error);
      Toast.show({
        content: error instanceof Error ? error.message : "投票失败",
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGuessWord = async () => {
    if (!roomId || !guessWordInput.trim()) return;

    try {
      setLoading(true);
      await guessWord(roomId, guessWordInput.trim());

      setGuessWordInput("");
    } catch (error) {
      console.error("猜词失败:", error);
      Toast.show({
        content: error instanceof Error ? error.message : "猜词失败",
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  // 踢出玩家
  const handleRemovePlayer = (playerId: string, playerName: string) => {
    if (!roomId || !isHost) return;

    Dialog.confirm({
      title: "踢出玩家",
      content: `确定要踢出玩家 "${playerName}" 吗？`,
      confirmText: "确定",
      cancelText: "取消",
      onConfirm: async () => {
        try {
          setLoading(true);
          await removePlayer(roomId, playerId);

          Toast.show({
            content: "玩家已被踢出",
            position: "bottom",
          });
        } catch (error) {
          console.error("踢出玩家失败:", error);
          Toast.show({
            content: error instanceof Error ? error.message : "踢出玩家失败",
            position: "bottom",
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  if (!currentRoom) {
    return (
      <div className="page-container">
        <div className="card">正在加载游戏信息...</div>
      </div>
    );
  }

  // 获取存活的非主持人玩家
  const livingPlayers = Object.values(currentRoom.players).filter(
    (p) => p.isAlive && !p.isHost
  );

  // 渲染玩家角色标识
  const renderRoleBadge = (role?: PlayerRole) => {
    if (!role) return null;

    let label = "";
    let className = "";

    switch (role) {
      case PlayerRole.GOOD:
        label = "好";
        className = "good";
        break;
      case PlayerRole.BAD:
        label = "坏";
        className = "bad";
        break;
      case PlayerRole.BLANK:
        label = "白";
        className = "blank";
        break;
    }

    return <div className={`role-badge ${className}`}>{label}</div>;
  };

  // 渲染游戏结束时的获胜信息
  const renderWinnerInfo = () => {
    if (!currentRoom.winners || currentRoom.winners.length === 0) {
      return <div>游戏结束，无人获胜</div>;
    }

    const winnerRole = currentRoom.winners[0];
    let message = "";

    switch (winnerRole) {
      case PlayerRole.GOOD:
        message = "好人阵营获胜！";
        break;
      case PlayerRole.BAD:
        message = "坏人阵营获胜！";
        break;
      case PlayerRole.BLANK:
        message = "白板获胜！";
        break;
    }

    return <div className="winner-display">{message}</div>;
  };

  return (
    <div className="page-container">
      <NavBar
        onBack={isEnded ? handleBackToLobby : undefined}
        backArrow={isEnded}
        right={
          isEnded ? null : (
            <Button size="small" onClick={handleBackToLobby}>
              退出
            </Button>
          )
        }
      >
        {isVoting ? "投票阶段" : isEnded ? "游戏结束" : "游戏进行中"}
      </NavBar>

      {isEnded && renderWinnerInfo()}

      {!isHost && playerRole !== undefined && (
        <div className="card">
          <h2>你的角色</h2>
          <div className="game-info">
            {playerRole === PlayerRole.GOOD && (
              <>
                <p>你的词语是：</p>
                <div className="word-display">{playerWord}</div>
              </>
            )}

            {playerRole === PlayerRole.BAD && (
              <>
                <p>你的词语是：</p>
                <div className="word-display">{playerWord}</div>
              </>
            )}

            {playerRole === PlayerRole.BLANK && (
              <>
                <p>
                  你是<strong>白板</strong>，你没有词语。
                </p>
                <p>尝试伪装成好人，通过观察推测好人的词语。</p>
              </>
            )}
          </div>
        </div>
      )}

      {isHost && isPlaying && (
        <div className="card">
          <h2>主持人控制面板</h2>
          <p>作为主持人，你可以开始投票环节</p>
          <div className="button-group">
            <Button
              color="primary"
              onClick={handleStartVote}
              loading={loading}
              disabled={loading}
            >
              开始投票
            </Button>
          </div>
        </div>
      )}

      {/* 主持人可以看到所有玩家的身份和词语 */}
      {isHost && (isPlaying || isVoting) && (
        <div className="card">
          <h2>玩家身份信息</h2>
          <p>作为主持人，你可以看到所有玩家的身份和词语</p>
          <div style={{ marginTop: "10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>玩家</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>身份</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>词语</th>
                  <th style={{ textAlign: "center", padding: "8px" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(currentRoom.players)
                  .filter((p) => !p.isHost)
                  .map((player) => {
                    let roleText = "";
                    let wordText = "";

                    switch (player.role) {
                      case PlayerRole.GOOD:
                        roleText = "好人";
                        wordText = currentRoom.config?.goodWord || "";
                        break;
                      case PlayerRole.BAD:
                        roleText = "坏人";
                        wordText = currentRoom.config?.badWord || "";
                        break;
                      case PlayerRole.BLANK:
                        roleText = "白板";
                        wordText = "无词语";
                        break;
                      default:
                        roleText = "未分配";
                        wordText = "无词语";
                    }

                    return (
                      <tr
                        key={player.id}
                        style={{ borderBottom: "1px solid #eee" }}
                      >
                        <td style={{ padding: "8px" }}>
                          {player.username}
                          {!player.isAlive && " (已出局)"}
                        </td>
                        <td style={{ padding: "8px" }}>{roleText}</td>
                        <td style={{ padding: "8px" }}>{wordText}</td>
                        <td style={{ textAlign: "center", padding: "8px" }}>
                          <Button
                            size="mini"
                            color="danger"
                            onClick={() =>
                              handleRemovePlayer(player.id, player.username)
                            }
                          >
                            踢出
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isHost && isVoting && (
        <div className="card">
          <h2>投票控制</h2>
          <p>当所有玩家都完成投票后，你可以结束投票</p>
          <div className="button-group">
            <Button
              color="primary"
              onClick={handleEndVote}
              loading={loading}
              disabled={loading}
            >
              结束投票
            </Button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>玩家列表</h2>
        <div className="player-list">
          {Object.values(currentRoom.players).map((player) => {
            // 跳过主持人
            if (player.isHost) return null;

            // 是否已被当前用户投票

            // 获取被投票数量
            const voteCount = player.votedBy?.length || 0;

            return (
              <div
                key={player.id}
                className={`player-item ${player.isAlive ? "alive" : "dead"}`}
              >
                <div className="player-name-container">
                  <span>{player.username}</span>
                  {isVoting && voteCount > 0 && (
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      {voteCount} 票
                    </div>
                  )}
                  {/* 主持人可以看到所有人的角色 */}
                  {isHost && player.role && renderRoleBadge(player.role)}

                  {/* 游戏结束时显示所有角色 */}
                  {isEnded && renderRoleBadge(player.role)}

                  {!player.isAlive && (
                    <div
                      style={{ fontSize: "12px", color: "var(--error-color)" }}
                    >
                      (已出局)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isVoting && isAlive && !isHost && (
        <div className="card">
          <h2>投票</h2>
          <p>选择你认为是坏人或白板的玩家进行投票</p>

          <Form layout="horizontal" style={{ marginTop: "16px" }}>
            <Form.Item label="选择玩家">
              <Radio.Group
                value={selectedPlayerId}
                onChange={(val) => setSelectedPlayerId(val as string)}
              >
                <Space direction="vertical">
                  {livingPlayers
                    .filter((p) => p.id !== user?.id) // 不能投自己
                    .map((player) => (
                      <Radio key={player.id} value={player.id}>
                        {player.username}{" "}
                        {currentPlayer?.voted === player.id && "(已投票)"}
                      </Radio>
                    ))}
                </Space>
              </Radio.Group>
            </Form.Item>
          </Form>

          <div className="button-group" style={{ justifyContent: "center" }}>
            <Button
              color="primary"
              onClick={handleVote}
              loading={loading}
              disabled={loading || !selectedPlayerId || !!currentPlayer?.voted}
            >
              投票
            </Button>
          </div>
        </div>
      )}

      {isPlaying &&
        isAlive &&
        !isHost &&
        (playerRole === PlayerRole.BAD || playerRole === PlayerRole.BLANK) && (
          <div className="card">
            <h2>猜词</h2>
            <p>如果你认为自己已经知道了好人的词，可以尝试猜测</p>
            <p style={{ color: "var(--error-color)", fontSize: "12px" }}>
              注意：猜错会导致你立即出局！
            </p>

            <Form layout="horizontal" style={{ marginTop: "16px" }}>
              <Form.Item label="猜测词语">
                <Input
                  placeholder="请输入你猜测的好人词语"
                  value={guessWordInput}
                  onChange={setGuessWordInput}
                />
              </Form.Item>
            </Form>

            <div className="button-group" style={{ justifyContent: "center" }}>
              <Button
                color="danger"
                onClick={handleGuessWord}
                loading={loading}
                disabled={loading || !guessWordInput.trim()}
              >
                确认猜词
              </Button>
            </div>
          </div>
        )}

      {isEnded && (
        <div className="card">
          <h2>游戏信息</h2>
          <p>好人词语: {currentRoom.config?.goodWord}</p>
          <p>坏人词语: {currentRoom.config?.badWord}</p>
          <div
            className="button-group"
            style={{ justifyContent: "center", marginTop: "16px" }}
          >
            <Button color="primary" onClick={handleBackToLobby}>
              返回大厅
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
