// server.js
const fs = require('fs');
const path = require('path');
const CLIENT_FILE = path.join(__dirname, 'data/clients.json');

// 用來儲存註冊的 client: { clientId: { host, port } }
const clients = new Map();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const port = 4000;

const app = express();
app.use(bodyParser.json());

function saveClientsToFile() {
  const jsonData = Object.fromEntries(clients);
  fs.writeFileSync(CLIENT_FILE, JSON.stringify(jsonData, null, 2));
}

// 啟動時載入 clients 資料
if (fs.existsSync(CLIENT_FILE)) {
  try {
    const rawData = fs.readFileSync(CLIENT_FILE, 'utf-8');
    const jsonData = JSON.parse(rawData);
    for (const [clientId, data] of Object.entries(jsonData)) {
      clients.set(clientId, data);
    }
    console.log(`已從檔案載入 ${clients.size} 個 client 資料`);
  } catch (err) {
    console.error('載入 clients.json 失敗:', err.message);
  }
}

/******************************
 * API
 *****************************/
app.post('/register', (req, res) => {
  const { clientId, host, port } = req.body;
  if (!clientId || !host || !port) {
    return res.status(400).json({ status: 'error', message: '參數不完整' });
  }
  // clients.set(clientId, { host, port });
  clients.set(clientId, { host, port, lastHeartbeat: Date.now() });
  saveClientsToFile();
  console.log(`Client ${clientId} 已註冊：${host}:${port}`);
  res.json({ status: 'ok' });
});

app.post('/heartbeat', (req, res) => {
  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ status: 'error', message: 'clientId 必須提供' });
  }

  const client = clients.get(clientId);
  if (client) {
    client.lastHeartbeat = Date.now();
    saveClientsToFile();
    console.log(`收到來自 ${clientId} 的心跳訊號`);
    res.json({ status: 'ok', message: '心跳訊號已接收' });
  } else {
    res.status(404).json({ status: 'error', message: 'Client 未註冊' });
  }
});

// 定期檢查 Client 的心跳狀態
setInterval(() => {
  const now = Date.now();
  clients.forEach((client, clientId) => {
    if (now - client.lastHeartbeat > 180000) {  // 超過 3 分鐘無心跳，視為離線
      console.log(`Client ${clientId} 已離線`);
      clients.delete(clientId);  // 移除離線的 client
      saveClientsToFile();
    }
  });
}, 30000);  // 每 30 秒檢查一次

app.post('/send', async (req, res) => {
  const { clientId, message } = req.body;
  if (!clientId || !message) {
    return res.status(400).json({ status: 'error', message: '參數不完整' });
  }

  // 發送給所有使用者
  if (clientId === '__ALL__') {
    const failed = [];
    for (const [id, client] of clients) {
      try {
        const axios = require('axios');
        const url = `http://${client.host}:${client.port}/notify`;
        await axios.post(url, { message });
        console.log(`訊息已發送給 ${id}`);
      } catch (err) {
        console.error(`無法傳送至 ${id}:`, err.message);
        failed.push(id.split('@')[0]);
      }
    }

    if (failed.length) {
      return res.status(207).json({
        status: 'partial',
        message: `部分使用者傳送失敗：${failed.join(', ')}`
      });
    } else {
      return res.json({ status: 'ok', message: '已發送給所有使用者' });
    }
  } else {
    // 發送給單一使用者
    const client = clients.get(clientId);
    if (!client) {
      return res.status(404).json({ status: 'error', message: '找不到 client' });
    }

    try {
      const axios = require('axios');
      const url = `http://${client.host}:${client.port}/notify`;
      await axios.post(url, { message });
      console.log(`訊息已轉發給 client ${clientId}`);
      res.json({ status: 'ok', message: '訊息已發送' });
    } catch (err) {
      console.error(`無法傳送至 client ${clientId}`, err.message);
      res.status(500).json({ status: 'error', message: '傳送失敗' });
    }
  }
});

app.get('/users', async (req, res) => {
  const userList = Array.from(clients.keys());
  res.json({ users: userList });
});

/*********************
 * WEB UI
 ********************/
// Login for Test
const validUsername = 'admin';
const validPassword = 'admin';

// 登入需要 session 的路由
const loginRouter = express.Router();
app.use('/web', loginRouter);
// 設定 session
loginRouter.use(session({
  secret: 'Glsjg3Y-SQBOsg-BgkqhkiG9w0BAQEFAA',
  resave: false,
  saveUninitialized: true,
}));

// 登入驗證 API
loginRouter.post('/auth_login', (req, res) => {
  const { username, password } = req.body;

  if (username === validUsername && password === validPassword) {
    req.session.authenticated = true;  // 設置 session 登入狀態
    res.json({ status: 'ok', message: '登入成功' });
  } else {
    res.status(401).json({ status: 'error', message: '帳號或密碼錯誤' });
  }
});

// 保護訊息發送頁面
loginRouter.use((req, res, next) => {
  // 如果未登入，跳轉至登入頁面
  if (req.url !== '/login.html' && !req.session.authenticated) {
    return res.status(401).sendFile(path.join(__dirname, 'public', 'login.html'));
  }
  next();
});

loginRouter.use(express.static(path.join(__dirname, 'public')));

// UI: 訊息發送
loginRouter.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 提供登入頁面
loginRouter.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Logout
loginRouter.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ status: 'error', message: '登出失敗' });
    }
    res.clearCookie('connect.sid'); // 可選，清除 cookie
    res.json({ status: 'ok', message: '已登出' });
  });
});

/********************
 * Local Service
 *******************/
app.listen(port, () => {
  console.log(`Server 執行中 http://localhost:${port}`);
});
