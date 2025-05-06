# About Project

This is an MVP-based project. For full-feature development, please contact me.

# How Install

## Environment

Nodejs version: 20+

Server: Linux or Windows

Client: Linux or Windows better

## Install

### Server

Build and enable service
```bash
cd notify_server
npm install
node server.js
```

Server will listen on port 4000

### Client

Edit ```.env``` file and set follows, and set SERVER_HOST and SERVER_PORT to yours

> CLIENT_ID represents a unique identity.

```txt
# Client Config
ClIENT_ID=Geust01
PORT=3000
HEARTBEAT_Interval=30000

# Server Config
SERVER_PROTOCOL=http
SERVER_HOST=127.0.0.1
SERVER_PORT=4000
```

Build and enable service
```bash
cd notify_client
npm install
node server.js
```
Server will listen on port 3000

## Server

The server provides a web interface that allows sending messages to specific clients or all connected clients.

![](document/1.%20connect.png)

Default login credentials are admin/admin.

![](document/0.%20login.png)

## Client

When a message is receiverd, a pop-up notification will appear.

![](document/2.%20popup-message.png)
