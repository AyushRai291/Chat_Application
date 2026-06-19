# Day 2 - Auth APIs

## Date
19 June 2026

## Done Today
- Created auth controller
- Created auth routes
- Created JWT token utility
- Created protectRoute middleware
- Added signup API
- Added login API
- Added logout API
- Added /me protected route

## APIs Completed

### Signup
POST /api/auth/signup

Tested:
- valid signup
- duplicate email
- invalid input validation

### Login
POST /api/auth/login

Tested:
- valid login
- wrong password
- JWT cookie set

### Logout
POST /api/auth/logout

Tested:
- cookie cleared
- logout response working

### Get Current User
GET /api/auth/me

Tested:
- without token gives 401
- with token returns logged-in user
- password not returned

## Files Added / Changed
- server/src/controllers/auth.controller.js
- server/src/routes/auth.routes.js
- server/src/utils/generateToken.js
- server/src/middlewares/auth.middleware.js
- server/src/app.js

## Concepts Learned
- bcrypt password hashing
- JWT token generation
- httpOnly cookies
- Zod validation
- Express routes and controllers
- Auth middleware
- Protected routes

## Issues Faced
- MongoDB Atlas IP whitelist issue after internet reconnect
- Fixed by adding 0.0.0.0/0 in Network Access for development
- Postman URL mistake: wrote POST inside URL box instead of using method dropdown

## Git
Commit:
Add auth APIs

Pushed to:
https://github.com/AyushRai291/Chat_Application.git

## Next Task
Day 3:
- Improve auth error handling
- Clean backend structure if needed
- Start frontend auth setup or continue backend auth improvements