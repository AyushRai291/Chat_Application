# AI Context - MERN Realtime Chat App

## Project Summary

This is a MERN realtime chat application with a React/Vite frontend, Express/MongoDB backend, Socket.io realtime layer, and JWT HttpOnly cookie authentication. The app supports direct chats, Saved Messages, message history, presence, typing indicators, delivery/read receipts, message actions, and per-user conversation hide/delete.

## Current Frontend Status

Completed:

* Premium AURORA dark app shell
* Login, signup, logout
* Auth session persistence with HttpOnly cookie
* Axios client with `withCredentials: true`
* REST conversation integration
* REST message history integration
* User search
* Direct conversation creation
* Saved Messages
* Message sending through REST
* Socket.io frontend connection
* Realtime `message:new`
* Realtime sidebar preview updates
* Online/offline presence
* Typing indicator
* Read receipt bug fixed by emitting `messages:read` when a realtime message arrives in the currently open conversation
* Message edit UI and REST integration
* Delete message for me
* Delete message for everyone
* Reply target and reply preview
* Emoji reactions
* Conversation hide/delete for current user via backend route
* Normal + incognito two-user realtime testing has been used as the main manual workflow

Pending:

* Upload image/file UI
* Group create/manage UI
* Block/report UI
* Notification UI
* Search messages UI
* Command palette
* Final responsive polish
* Deployment polish

## Important Frontend Files

* `client/src/lib/api.js`
* `client/src/lib/socket.js`
* `client/src/context/AuthContext.jsx`
* `client/src/context/ChatContext.jsx`
* `client/src/services/authService.js`
* `client/src/services/userService.js`
* `client/src/services/conversationService.js`
* `client/src/services/messageService.js`
* `client/src/components/layout/AppShell.jsx`
* `client/src/components/layout/Sidebar.jsx`
* `client/src/components/layout/ChatPanel.jsx`
* `client/src/components/layout/InfoPanel.jsx`
* `client/src/components/chat/ConversationItem.jsx`
* `client/src/components/chat/MessageBubble.jsx`
* `client/src/components/chat/Composer.jsx`
* `client/src/components/users/UserSearch.jsx`

## Important Backend Files

* `server/src/app.js`
* `server/src/server.js`
* `server/src/models/User.js`
* `server/src/models/Conversation.js`
* `server/src/models/Message.js`
* `server/src/controllers/auth.controller.js`
* `server/src/controllers/conversation.controller.js`
* `server/src/controllers/message.controller.js`
* `server/src/controllers/user.controller.js`
* `server/src/routes/auth.routes.js`
* `server/src/routes/conversation.routes.js`
* `server/src/routes/message.routes.js`
* `server/src/routes/user.routes.js`
* `server/src/socket/socket.js`

## Frontend Rules

* Do not redesign the AURORA UI unless explicitly asked.
* Do not rewrite the whole app.
* Do not touch unrelated files.
* Keep changes modular and small.
* Preserve existing REST flow.
* Preserve existing socket flow.
* Avoid duplicate socket listeners.
* Avoid duplicate messages on sender side.
* Use safe id comparison: `String(value?._id || value || "")`.
* Add `type="button"` to non-submit buttons.
* Do not invent backend endpoints.
* If a backend route does not exist, do not fake the frontend feature.
* Prefer updating shared state in `ChatContext.jsx` instead of spreading chat logic across components.

## Backend API Contract

Auth:

* `POST /api/auth/signup`
* `POST /api/auth/login`
* `POST /api/auth/logout`
* `GET /api/auth/me`

Users:

* `GET /api/users?search=`

Conversations:

* `GET /api/conversations`
* `POST /api/conversations`
  * Saved messages body: `{ "isSelf": true }`
  * Direct chat body: `{ "receiverId": "USER_ID" }`
* `DELETE /api/conversations/:conversationId/for-me`
  * Hides/clears the conversation for the current user only.
  * Does not delete the other user's conversation.
  * A later new message should reveal the conversation again.

Group routes exist on the backend, but frontend group management UI is still pending:

* `POST /api/conversations/groups`
* `PATCH /api/conversations/:conversationId/group`
* `PATCH /api/conversations/:conversationId/group/settings`
* `POST /api/conversations/:conversationId/participants`
* `DELETE /api/conversations/:conversationId/participants/:participantId`
* `POST /api/conversations/:conversationId/leave`
* `DELETE /api/conversations/:conversationId`

Messages:

* `GET /api/messages/:conversationId`
* `GET /api/messages/search`
* `POST /api/messages`
* `PATCH /api/messages/:messageId`
  * Body: `{ "text": "updated text" }`
* `DELETE /api/messages/:messageId/for-me`
* `DELETE /api/messages/:messageId/for-everyone`
* `POST /api/messages/:messageId/reactions`
  * Body: `{ "emoji": "..." }`

Uploads:

* `POST /api/messages/upload`
* Upload UI is not implemented yet.

## Socket Contract

Socket client:

* URL: `import.meta.env.VITE_SOCKET_URL || "http://localhost:5000"`
* `withCredentials: true`
* `transports: ["websocket"]`
* `autoConnect: false`
* Connect only after authenticated user exists.
* Disconnect on logout/unmount.

Incoming socket events currently relevant:

* `message:new`
* `message:updated`
* `message:deleted-for-me`
* `message:deleted-for-everyone`
* `message:reaction-updated`
* `conversation:deleted-for-me`
* `typing:start`
* `typing:stop`
* `receipt:delivered`
* `receipt:read`
* `presence:online-users`
* `presence:update`
* `conversation:created`
* `conversation:updated`
* `conversation:deleted`
* `notification:new`

Outgoing socket events currently used:

* `typing:start`
* `typing:stop`
* `messages:read`

Important socket behavior:

* `message:new` must dedupe by `_id`.
* If realtime message belongs to selected conversation and sender is not current user, emit `messages:read`.
* Read receipts should update message status to `read`.
* Sender should not get duplicate messages when REST send and socket event both happen.
* Socket handlers should remain source of truth even when REST actions optimistically update local state.

## Current Known State

Core chat frontend is working. Realtime messages between normal browser and incognito have been tested. Online/offline presence, typing indicator, and read receipts are working. Message actions and conversation hide/delete have been added and should be tested with two users before considering final polish done.

## Current Main Next Task

Likely next frontend tasks:

* Test message actions end to end with two users.
* Implement upload image/file UI using existing backend upload route.
* Implement search messages UI.
* Implement notification UI.
* Implement group create/manage UI.

## Testing Commands

Frontend:

```bash
cd client
npm run dev
npm run build
```

Backend:

```bash
cd server
npm run dev
node --check src/controllers/conversation.controller.js
node --check src/controllers/message.controller.js
node --check src/routes/conversation.routes.js
node --check src/models/Conversation.js
```

Manual tests:

1. Login as User A in normal browser.
2. Login as User B in incognito.
3. Open the same direct conversation.
4. Send message from A to B.
5. B should receive without refresh.
6. A should not see duplicate message.
7. Typing indicator should show.
8. Online/offline dot should update.
9. Seen/read tick should update after B views message.
10. Edit a message and verify realtime update.
11. Delete for me and verify only current user loses the message.
12. Delete for everyone and verify both users see deleted placeholder.
13. Reply to a message and verify reply preview persists after refresh.
14. Toggle reactions and verify realtime update.
15. Delete/hide conversation for current user and verify the other user still has it.
16. Refresh should reload history from DB.

## Git Rule

After each stable feature:

```bash
git status
git add .
git commit -m "short meaningful message"
```
