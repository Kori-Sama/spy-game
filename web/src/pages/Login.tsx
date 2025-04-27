import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Toast } from "antd-mobile";
import { useUserStore } from "../stores/userStore";
import { useSocketStore } from "../stores/socketStore";

const Login = () => {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useUserStore();
  const { socket } = useSocketStore();

  const handleLogin = async () => {
    if (!username.trim()) {
      Toast.show({
        content: "请输入用户名",
        position: "bottom",
      });
      return;
    }

    try {
      setLoading(true);
      const user = await register(username.trim());

      // 如果Socket已连接，则进行认证
      if (socket && user) {
        socket.emit("authenticate", { userId: user.id });
      }

      // 登录成功后跳转到主页
      navigate("/home");

      Toast.show({
        content: "登录成功",
        position: "bottom",
      });
    } catch (error) {
      console.error("登录失败:", error);
      Toast.show({
        content: "登录失败，请重试",
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="card">
        <h1 style={{ textAlign: "center", marginBottom: "24px" }}>
          间谍猜词游戏
        </h1>
        <Form layout="vertical">
          <Form.Item label="输入用户名" required>
            <Input
              placeholder="请输入用户名"
              value={username}
              onChange={setUsername}
              onEnterPress={handleLogin}
            />
          </Form.Item>
          <Button
            block
            color="primary"
            size="large"
            loading={loading}
            onClick={handleLogin}
            style={{ marginTop: "16px" }}
          >
            开始游戏
          </Button>
        </Form>
      </div>
    </div>
  );
};

export default Login;
