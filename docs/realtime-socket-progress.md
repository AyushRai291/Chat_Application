# Realtime Socket Progress

Date: 2026-06-22

Status: Socket setup, realtime message receive, aur presence base working hai.

## Aaj Kya Kaam Hua

- Server ko `app.listen` se `http.createServer(app)` par shift kiya.
- Socket.io ko same HTTP server par attach kiya, isliye Express APIs aur socket events dono port `5000` par chal rahe hain.
- `server/src/socket/socket.js` me Socket.io setup add hua.
- Socket connection ke time JWT cookie se user authenticate ho raha hai.
- Authenticated socket ko personal room me join karaya ja raha hai: `user:<userId>`.
- Test ke liye `ping:server` aur `pong:client` event add kiya.
- Client side `socket.io-client` setup hua.
- Client se login, socket connect, ping, saved conversation, aur message send test flow banaya.
- `sendMessage` controller me DB save ke baad `message:new` socket event emit ho raha hai.
- Realtime message receive browser me confirm hua.
- `User` model me `isOnline` aur `lastSeen` fields add hue.
- Socket connect par user online mark hota hai.
- Socket disconnect par user offline mark hota hai aur `lastSeen` update hota hai.
- Presence events me ab raw IDs ke saath user details bhi ja rahi hain.
- Client presence UI me name/email ke saath online users aur readable last seen dikh raha hai.

## Files Touched

### Server

- `server/src/server.js`
  - Express app ko HTTP server me wrap kiya.
  - `setupSocket(httpServer)` call add kiya.

- `server/src/socket/socket.js`
  - Socket.io server setup.
  - JWT cookie based socket auth.
  - User personal room join.
  - Ping/pong test event.
  - Multi-tab safe online/offline tracking.
  - Presence events: `presence:online-users` aur `presence:update`.

- `server/src/models/User.js`
  - `isOnline` field add kiya.
  - `lastSeen` field add kiya.

- `server/src/controllers/message.controller.js`
  - `getIO()` import add kiya.
  - Message save hone ke baad participants ko `message:new` event emit kiya.

### Client

- `client/package.json`
  - Vite dev script add kiya.

- `client/index.html`
  - React app mount ke liye base HTML add kiya.

- `client/src/lib/socket.js`
  - Single reusable socket client instance banaya.
  - `withCredentials: true` add kiya, taaki JWT cookie socket handshake ke saath ja sake.

- `client/src/main.jsx`
  - Login test form.
  - Saved conversation create button.
  - Socket connect, ping, disconnect controls.
  - Message send form.
  - `message:new` listener se realtime messages UI me add ho rahe hain.
  - Presence list user name/email ke saath show ho rahi hai.
  - Last presence updates readable date/time ke saath show ho rahe hain.

## Test Flow

Server:

```powershell
cd server
npm run dev
```

Client:

```powershell
cd client
npm run dev
```

Browser:

```txt
http://localhost:5173
```

Steps:

1. Email/password se login karo.
2. `Create Saved Conversation` click karo.
3. `Connect Socket` click karo.
4. `Ping` click karo.
5. Message type karke `Send` click karo.
6. `Disconnect` click karke offline + last seen test karo.

Expected result:

- Ping ke baad `Socket connected successfully` ya connected status aata hai.
- Message send karne ke baad status `New message received.` hota hai.
- Message list me new message socket event se add hota hai.
- Presence me logged-in user ka name/email online list me dikhna chahiye.
- Disconnect ke baad user offline update aur readable last seen dikhna chahiye.

## Important Learning Notes

- HTTP API message ko database me save karti hai.
- Socket.io message ko realtime browser tak push karta hai.
- `withCredentials: true` client side important hai, warna JWT cookie socket handshake me nahi jayegi.
- Socket auth middleware Express `protectRoute` jaisa hai, bas socket connection ke liye.
- `user:<userId>` room future features ke liye base hai:
  - private realtime messages
  - online/offline status
  - last seen
  - typing indicator
  - delivery/read receipts
- `onlineUsers` map same user ke multiple tabs/devices ko track karta hai.
- User tabhi offline mark hota hai jab uske saare active sockets disconnect ho jaate hain.

## Current Known Cleanup

- Test UI temporary hai. Later proper Chat UI ke saath replace hoga.
- Presence UI abhi learning/testing ke liye simple HTML controls use kar raha hai.

## Roadmap Status

Current feature layer:

```txt
Online/offline status + last seen
```

Done:

1. `User` model me `isOnline` aur `lastSeen` fields add karna.
2. Socket connect par user online mark karna.
3. Socket disconnect par user offline aur `lastSeen` update karna.
4. Client ko online users ka event emit karna.
5. Presence UI ko user details ke saath upgrade karna.

Next feature layer:

```txt
Typing indicator
```
