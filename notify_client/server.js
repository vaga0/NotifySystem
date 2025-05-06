import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import axios from 'axios';
import notifier from 'node-notifier';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000');

const server_protocol = process.env.SERVER_PROTOCOL || 'http';
const server_port = process.env.SERVER_PORT || '4000';
const server_host = process.env.SERVER_HOST || '127.0.0.1';
const serverUrl = `${server_protocol}://${server_host}:${server_port}`;

const snoreToastPath = path.join(__dirname, 'bin/SnoreToast.exe');
const clientId = await getOrCreateClientId();
console.log(clientId);
app.use(express.json());

let heartbeatInterval = null;

app.listen(port, async () => {
  console.log(`API 伺服器執行中 http://localhost:${port}`);
  await registerClient(); // 啟動時註冊
});

app.post('/notify', (req, res) => {
  const message = req.body.message || '收到新通知';
  console.log(`Get a new message and pop to windows`);

  notifier.notify({
    title: 'API 通知',
    message: message,
    sound: true,
    appID: 'Hannstar Service Notify Client-Side',
    customPath: snoreToastPath,
  });

  res.send({ status: 'ok', message: '通知已發送' });
});

async function registerClient(retry = true, maxRetrytimes = 0) {
  const ip = getLocalIpAddress();
  try {
    await axios.post(`${serverUrl}/register`, {
      clientId,
      host: ip,
      port,
    });
    console.log(`✅ 成功註冊至 Server (${serverUrl}) 為 ${clientId}`);
    if (!heartbeatInterval) startHeartbeat();
  } catch (err) {
    console.error('❌ 註冊失敗:', err.message);
    
    if (retry && maxRetrytimes < 3) {
      maxRetrytimes++;
      console.log('⏳ 10 秒後重試註冊...(retry times: ' + maxRetrytimes + ')');
      setTimeout(() => registerClient(true, maxRetrytimes), 2000);
    }
  }
}

function startHeartbeat() {
  heartbeatInterval = setInterval(async () => {
    try {
      await axios.post(`${serverUrl}/heartbeat`, { clientId });
      console.log('❤️ 心跳訊號發送成功');
    } catch (err) {
      if (err.response?.status === 404) {
        console.warn('⚠️ Server 回應 404，需重新註冊');
        await registerClient();
      } else {
        console.error('💥 心跳發送失敗:', err.message);
      }
    }
  }, parseInt(process.env.HEARTBEAT_Interval || '30000'));
}

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

async function getOrCreateClientId() {
  const dataDir = path.join(__dirname, 'data');
  const idFile = path.join(dataDir, 'client-id.txt');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(idFile)) {
    return fs.readFileSync(idFile, 'utf-8').trim();
  }

  // const id = os.hostname(); // ex. 30026581-N1, 或用自訂名稱
  const id = (process.env.CLIENT_ID || os.hostname()) + '@' + nanoid(); // ex. 30026581-N1, 或用自訂名稱
  // const id = nanoid(); // 21 字元
  fs.writeFileSync(idFile, id, 'utf-8');
  return id;
}
