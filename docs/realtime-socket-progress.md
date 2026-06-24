# Realtime Socket Progress

Date: 2026-06-22

Status: Socket setup, realtime message receive, presence base, typing indicator, receipts, message actions, uploads, groups/admin controls, search, aur command palette working layer ready hai.

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
- Typing indicator socket events add hue: `typing:start` aur `typing:stop`.
- Typing events conversation membership verify karne ke baad hi emit hote hain.
- Client message input type karte waqt typing start bhejta hai aur pause/send/disconnect par stop bhejta hai.
- Direct conversation testing ke liye client me user search + chat button add hua.
- Delivered/read receipts add hue.
- Online receiver ke liye new message auto-delivered mark hota hai.
- Socket connect par pending messages delivered mark hote hain.
- Current conversation read mark karne par `readBy` update hota hai aur sender ko realtime receipt milta hai.
- Client message list me Sent/Delivered/Read label dikh raha hai.
- Message edit endpoint add hua.
- Delete for me endpoint add hua.
- Delete for everyone endpoint add hua.
- Emoji reaction toggle endpoint add hua.
- Reply-to-message UI add hua; backend reply support pehle se send flow me tha.
- Message action socket events add hue: `message:updated`, `message:deleted-for-me`, `message:deleted-for-everyone`, `message:reaction-updated`.
- Image/file upload layer add hua.
- Local upload storage `server/uploads` use ho raha hai.
- `/uploads/...` static serving add hua.
- Upload API attachments metadata return karti hai, phir message send me attachments attach hote hain.
- Client me file picker, upload button, pending attachments preview, image preview, aur file download links add hue.
- Group chat layer add hua.
- Admin controls add hue: rename group, add member, remove member.
- Leave group flow add hua.
- Group conversation updates realtime `conversation:created` / `conversation:updated` events se sync hote hain.
- Message search API add hua.
- Client me current/global message search controls add hue.
- Command palette add hua with `Ctrl+K` / `Cmd+K` shortcut.

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
  - Typing events: `typing:start` aur `typing:stop`.
  - Typing events ke liye conversation membership check.
  - Receipt events: `receipt:delivered` aur `receipt:read`.
  - `messages:read` event se conversation ke unread messages read mark hote hain.

- `server/src/middlewares/upload.middleware.js`
  - Multer local disk storage setup.
  - File type allowlist.
  - 10MB per-file limit.
  - Maximum 5 files per upload.

- `server/src/models/User.js`
  - `isOnline` field add kiya.
  - `lastSeen` field add kiya.

- `server/src/controllers/message.controller.js`
  - `getIO()` import add kiya.
  - Message save hone ke baad participants ko `message:new` event emit kiya.
  - Online recipients ke liye initial `deliveredTo` aur message `status` calculate kiya.
  - Message edit/delete/reaction controllers add kiye.
  - Message action updates conversation participants ko realtime emit hote hain.
  - Upload controller attachments metadata return karta hai.
  - Message search controller add hua.

- `server/src/controllers/conversation.controller.js`
  - Group create controller.
  - Group update/rename controller.
  - Add group participant controller.
  - Remove group participant controller.
  - Leave group controller.

- `server/src/routes/conversation.routes.js`
  - `POST /api/conversations/groups`
  - `PATCH /api/conversations/:conversationId/group`
  - `POST /api/conversations/:conversationId/participants`
  - `DELETE /api/conversations/:conversationId/participants/:participantId`
  - `POST /api/conversations/:conversationId/leave`

- `server/src/routes/message.routes.js`
  - `GET /api/messages/search`
  - `POST /api/messages/upload`
  - `PATCH /api/messages/:messageId`
  - `DELETE /api/messages/:messageId/for-me`
  - `DELETE /api/messages/:messageId/for-everyone`
  - `POST /api/messages/:messageId/reactions`

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
  - User search aur direct conversation create test controls.
  - Typing indicator display.
  - Message receipts UI: Sent/Delivered/Read.
  - `Mark Conversation Read` test control.
  - Reply, edit, delete for me, delete for everyone, aur emoji reaction test controls.
  - Upload controls aur attachment rendering.
  - Group create/admin/member management controls.
  - Message search UI.
  - Command palette UI.

- `server/package.json`
  - `multer` dependency add hui.

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
4. `Search` se doosra user dhoondo aur `Chat` click karke direct conversation banao.
5. `Ping` click karo.
6. Message type karke `Send` click karo.
7. Typing indicator test ke liye second browser/tab me doosre user se same conversation open karo.
8. Receiver side par `Mark Conversation Read` click karo.
9. Message row ke action buttons se reply/edit/delete/reaction test karo.
10. File select karo, `Upload` click karo, phir `Send` click karo.
11. Group create karo with comma-separated participant IDs.
12. Admin user se rename/add/remove controls test karo.
13. Message search test karo.
14. `Ctrl+K` / `Cmd+K` command palette test karo.
15. `Disconnect` click karke offline + last seen test karo.

Expected result:

- Ping ke baad `Socket connected successfully` ya connected status aata hai.
- Message send karne ke baad status `New message received.` hota hai.
- Message list me new message socket event se add hota hai.
- Presence me logged-in user ka name/email online list me dikhna chahiye.
- Disconnect ke baad user offline update aur readable last seen dikhna chahiye.
- Jab doosra participant same conversation me type kare, UI me `<name> is typing...` dikhna chahiye.
- Typing rukne/send/disconnect par typing indicator clear hona chahiye.
- Sender side message status `Sent` se `Delivered` ya `Read` me update hona chahiye.
- Receiver side read mark karne par sender ko realtime `Read` status dikhna chahiye.
- Edit karne par dono users ko edited text aur `(edited)` dikhna chahiye.
- Delete for me karne par sirf current user ki list se message remove hona chahiye.
- Delete for everyone karne par dono users ko `This message was deleted` dikhna chahiye.
- Reaction toggle karne par dono users ko updated reaction list dikhni chahiye.
- Reply send karne par message ke upar reply preview dikhna chahiye.
- Image upload karne par image inline preview me dikhni chahiye.
- Non-image file upload karne par clickable download/open link dikhna chahiye.
- Group create karne par group ID current conversation ban jana chahiye.
- Admin rename/add/remove actions realtime group details update karne chahiye.
- Message search current conversation ya all conversations me scoped result dikhana chahiye.
- Command palette se existing actions run hone chahiye.

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
- Typing indicator database me save nahi hota, kyunki ye short-lived realtime state hai.
- Server typing event emit karne se pehle check karta hai ki sender conversation ka participant hai.
- Delivery/read receipts database me save hote hain:
  - `deliveredTo` per-user delivery state track karta hai.
  - `readBy` per-user read state track karta hai.
  - `status` direct chat ke liye simple Sent/Delivered/Read label deta hai.
- Delete for me user-specific hai aur `deletedFor` array me save hota hai.
- Delete for everyone shared state hai aur `deletedForEveryone` true karta hai.
- Reactions one-reaction-per-user toggle model use karti hain.
- Uploads abhi local disk storage use karte hain. Production phase me Cloudinary/S3 storage swap karna better rahega.
- Group admin controls sirf current admin ko allowed hain.

## Current Known Cleanup

- Test UI temporary hai. Later proper Chat UI ke saath replace hoga.
- Presence UI abhi learning/testing ke liye simple HTML controls use kar raha hai.

## Roadmap Status

Current feature layer:

```txt
Search + command palette
```

Done:

1. Message search endpoint add karna.
2. Participant-scoped search permissions add karna.
3. Current/all conversation search UI add karna.
4. Search result open action add karna.
5. Command palette add karna.
6. `Ctrl+K` / `Cmd+K` shortcut add karna.

Next feature layer:

```txt
Notifications
```

## Extra Advanced Ideas

- Cloudinary/S3 upload provider with signed uploads.
- Image compression and thumbnail generation.
- Voice notes.
- Link previews.
- Message pinning.
- Conversation mute/archive.
- Block/report user safety controls.
- Full-text message search with MongoDB text indexes.
