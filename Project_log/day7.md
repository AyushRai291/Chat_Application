# Day 7 - Messages API + Endpoint Map

## Goal
Messages ko database me save/read karna aur frontend ke liye backend endpoint contract finalize karna.

## Done
- Created `message.controller.js`
- Created `message.routes.js`
- Connected `/api/messages` in `app.js`
- Added protected route: `GET /api/messages/:conversationId`
- Added protected route: `POST /api/messages`
- Added message pagination support using `limit` and `before`
- Added conversation membership check before reading or sending messages
- Added invalid ObjectId handling for conversation and reply message IDs
- Added empty-message protection: message needs text or attachment
- Added `lastMessage` update after sending a message
- Added sender population in message responses
- Added reply-to validation inside the same conversation
- Created `docs/endpoint-map.md`
- Documented auth, users, conversations, and messages endpoints

## APIs

### Get Messages
GET `/api/messages/:conversationId`

Auth:
- Requires JWT cookie
- Uses `protectRoute`
- User must be a participant of the conversation

Optional query params:
- `limit`
- `before`

Example:
```http
GET /api/messages/CONVERSATION_ID?limit=30
```

### Send Message
POST `/api/messages`

Auth:
- Requires JWT cookie
- Uses `protectRoute`
- User must be a participant of the conversation

Body:
```json
{
  "conversationId": "CONVERSATION_ID",
  "text": "Hello"
}
```

Reply body:
```json
{
  "conversationId": "CONVERSATION_ID",
  "text": "Reply message",
  "replyTo": "MESSAGE_ID"
}
```

## Files Added
- `server/src/controllers/message.controller.js`
- `server/src/routes/message.routes.js`
- `docs/endpoint-map.md`

## Files Updated
- `server/src/app.js`
- `server/src/models/Message.js`
- `server/src/models/Conversation.js`
- `server/src/controllers/conversation.controller.js`
- `server/src/controllers/user.controller.js`
- `server/src/middlewares/error.middleware.js`
- `server/src/config/db.js`
- `server/src/config/env.js`
- `server/src/server.js`
- `server/.env.example`

## Extra Cleanup Done
- User search regex input is now escaped
- User search results are limited to 20
- Conversation creation now uses `conversationKey` to reduce duplicate DM/self-chat risk
- `isSelf` must be a real boolean
- Startup now validates required env vars
- Global error handler now handles validation, duplicate key, and invalid ID errors better

## Tested
- `node --check` passed for all backend JS files
- App import check passed
- Mongoose model validation smoke test passed
- Live Thunder Client/API flow is still pending

## Current Backend Status
Completed:
- Project setup
- MongoDB Atlas connection
- User model
- Auth APIs
- JWT HttpOnly cookie auth
- Global error handling
- Conversation model
- Message model
- Users search API
- Conversations API
- Messages API
- Endpoint map

Pending:
- Manual Thunder Client test for full flow
- Socket.io realtime backend
- Upload endpoint
- Group chat APIs
- Later security hardening

## Next Task
Day 8:
- Frontend AI Chunk 0
- Use `docs/endpoint-map.md` as backend contract
- Ask AI only for project audit and build map first
- Do not start frontend chunks without testing current APIs once manually
