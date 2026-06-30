# Deployment Notes

## Backend

- Start command: `npm --prefix server start`
- Health check: `GET /health` returns `{ "status": "ok" }`
- Profile update endpoint: `PATCH /api/users/me` with `{ "name": "...", "avatar": "..." }`

Required backend environment variables:

- `PORT`
- `NODE_ENV`
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`

`CLIENT_URL` must match the deployed frontend URL exactly. Multiple frontend origins can be comma-separated.

For MongoDB Atlas, make sure Network Access allows the deployment host to connect.

## Frontend

- Build command: `npm --prefix client run build`

Required frontend environment variables:

- `VITE_API_URL`

`VITE_API_URL` must match the deployed backend URL exactly.

## Uploads

The backend serves local uploads from `/uploads`. Local upload files are not persistent on many free hosts and can disappear after restart or redeploy. Use persistent disk storage or object storage later if uploads must survive redeploys.
