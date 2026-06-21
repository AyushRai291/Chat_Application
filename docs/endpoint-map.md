# ChatApp Endpoint Map

Base URL: `http://localhost:5000`

Auth uses an HttpOnly `jwt` cookie. Protected endpoints require the cookie to be present.

## Health

### GET `/`
Returns plain text: `API running`.

### GET `/api/test`
Returns a test JSON response.

## Auth

### POST `/api/auth/signup`
Body:
```json
{
  "name": "Ayush",
  "email": "ayush@example.com",
  "password": "password123"
}
```

Response: creates user, sets `jwt` cookie, returns safe user fields.

### POST `/api/auth/login`
Body:
```json
{
  "email": "ayush@example.com",
  "password": "password123"
}
```

Response: sets `jwt` cookie and returns safe user fields.

### POST `/api/auth/logout`
Clears the `jwt` cookie.

### GET `/api/auth/me`
Protected. Returns the current logged-in user.

## Users

### GET `/api/users?search=<keyword>`
Protected. Returns up to 20 users, excluding the current user.

## Conversations

### GET `/api/conversations`
Protected. Returns the current user's conversations sorted by latest update.

### POST `/api/conversations`
Protected. Opens or creates a conversation.

Saved Messages body:
```json
{
  "isSelf": true
}
```

Direct message body:
```json
{
  "receiverId": "USER_OBJECT_ID"
}
```

## Messages

### GET `/api/messages/:conversationId`
Protected. Returns messages for a conversation the current user belongs to.

Optional query params:
- `limit`: number from 1 to 50, default 30
- `before`: ISO date cursor for older messages

### POST `/api/messages`
Protected. Sends a message in a conversation the current user belongs to.

Body:
```json
{
  "conversationId": "CONVERSATION_OBJECT_ID",
  "text": "Hello",
  "replyTo": "OPTIONAL_MESSAGE_OBJECT_ID"
}
```

Response: returns the created message with populated sender.
