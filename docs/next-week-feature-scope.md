# Next Week Feature Scope

## Goal
ChatApp ko advanced MERN realtime chat app banana hai, but features ko smart order me build karna hai. Ek saath sab features add nahi karne, warna project unstable ho sakta hai.

## Locked Features
- Real-time messages
- Online/offline status
- Last seen
- Typing indicator
- Delivery/read receipts
- Message edit
- Delete for me
- Delete for everyone
- Emoji reactions
- Reply to message
- Saved Messages
- Image/file upload
- Group chat
- Admin controls
- Search
- Command palette
- Notifications
- Premium AURORA frontend
- 3D aurora layer later

## Correct Build Order
1. Socket.io setup - done
2. Real-time send/receive - done
3. Online/offline + last seen - done
4. Typing indicator - done
5. Delivered/read receipts - done
6. Edit/delete/reactions/reply - done
7. Uploads - done
8. Groups - done
9. Frontend polish + AURORA chunks - later

## Current Remaining Scope
- Search
- Command palette
- Notifications
- Premium AURORA frontend
- 3D aurora layer later

## Extra Advanced Ideas To Consider
- Cloudinary/S3 uploads for production storage
- Image thumbnails and compression
- Voice notes
- Link previews
- Pinned messages
- Mute/archive conversations
- Block/report user safety controls
- Full-text message search with MongoDB indexes

## Working Rules
- Heavy work next week, but changes must stay structured and reviewable.
- Build one feature layer at a time.
- Keep backend contracts stable before connecting frontend chunks.
- Review each feature for runtime errors, auth checks, data ownership, invalid IDs, duplicate states, and clean response shapes.
- Avoid production deployment hardening until the planned deployment phase.
- Keep advanced UI/3D polish after the core chat flow works.

## Codex Review Role
Codex should:
- Review every new feature as it is added.
- Fix obvious bugs and unsafe edge cases.
- Keep code structure clean and consistent with the existing backend.
- Make the app more advanced without breaking the learning roadmap.
- Prefer small, tested steps over big unstable rewrites.
