# Day 5 - Users Search API

## Done
- Created `user.controller.js`
- Created `user.routes.js`
- Connected `/api/users` in `app.js`
- Added protected route: `GET /api/users?search=`
- Search works by `name` or `email`
- Current logged-in user excluded
- Password hidden using `.select("-password")`

## API
GET `/api/users?search=<keyword>`

Auth:
- Requires JWT cookie
- Uses `protectRoute`

## Tested
- Logged in as Ayush
- Created second user: `test@test.com`
- `GET /api/users?search=test` returns Test User
- Current user not returned
- Password not returned
- After logout, same API returns `401 Unauthorized`

## Files
- `server/src/controllers/user.controller.js`
- `server/src/routes/user.routes.js`
- `server/src/app.js`

## Next
Day 6:
- `GET /api/conversations`
- `POST /api/conversations`
- find-or-create 1-to-1 conversation