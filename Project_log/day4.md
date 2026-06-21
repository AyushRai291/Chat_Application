Database structure ready karna:
- users ke beech 1-to-1 chat support
- future group chat support
- messages store karna
- last message track karna
- future read receipts/uploads/reactions ke liye space rakhna




# Day 4 - Conversation & Message Schema Design

## Goal
Chat application ke liye database schema ready karna.

## Done Today
- Created Conversation model
- Created Message model
- Added participants support
- Added group chat fields
- Added lastMessage reference
- Added message attachments structure
- Added message status field
- Added readBy and deliveredTo fields
- Added reactions structure
- Added replyTo support
- Added edit/delete related fields
- Added useful indexes
- Verified server runs without schema/import error

## Files Added
- server/src/models/Conversation.js
- server/src/models/Message.js

## Conversation Model Fields
- participants
- isGroup
- groupName
- groupAvatar
- admin
- lastMessage
- timestamps

## Message Model Fields
- conversation
- sender
- text
- attachments
- status
- readBy
- deliveredTo
- reactions
- replyTo
- isEdited
- deletedFor
- deletedForEveryone
- timestamps

## Indexes Added

### Conversation
- participants
- updatedAt

### Message
- conversation + createdAt
- sender

## Concepts Learned
- Mongoose references
- ObjectId
- ref
- embedded subdocuments
- timestamps
- enum fields
- indexes
- future-proof schema design

## Current Backend Status
Completed:
- User model
- Auth APIs
- Global error handling
- Conversation model
- Message model

Pending:
- Users search API
- Conversations API
- Messages API
- endpoint-map.md

## Next Task
Day 5:
- Create Users API
- GET /api/users?search=
- Exclude logged-in user
- Protect route using protectRoute middleware