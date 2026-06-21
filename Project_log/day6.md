# Day 6 - Conversations API

## Done
- Added `isSelf` field in `Conversation` model
- Created `conversation.controller.js`
- Created `conversation.routes.js`
- Connected `/api/conversations` in `app.js`
- Added `GET /api/conversations`
- Added `POST /api/conversations`
- Added Saved Messages support
- Added normal 1-to-1 DM support
- Prevented duplicate self conversation
- Prevented duplicate normal DM
- Added safer conversation filtering

## APIs
GET `/api/conversations`

POST `/api/conversations`

Saved Messages body:
```json
{ "isSelf": true }