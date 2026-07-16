# AuthController.js Quick Notes

## Signup
- `safeParse(req.body)` → input validate karta hai.
- Invalid input → `400 Bad Request`.
- `result.data` use karte hain kyunki ye validated/cleaned data hota hai.
- Email lowercase → duplicate email bug avoid.
- `User.findOne({ email })` → existing user check.
- Existing user → `400 Email already exists`.
- `bcrypt.hash(password, 10)` → password hash karta hai.
- `10` = salt rounds/cost factor, length nahi.
- `User.create()` → new user DB me save.
- `generateToken(user._id, res)` → JWT cookie set.
- Success → `201 Created`.

## Login
- `loginSchema.safeParse(req.body)` → email/password validate.
- Password `.min(1)` → bas empty check, signup rule enforce nahi.
- Email lowercase → same email casing issue avoid.
- `User.findOne({ email })` → user find.
- User missing → `Invalid credentials`.
- Wrong password → `Invalid credentials`.
- Generic message security ke liye hota hai.
- `bcrypt.compare(password, user.password)` → plain password vs hashed password compare.
- Success → `generateToken(user._id, res)`.
- Login success → `200 OK`, kyunki new resource create nahi hota.

## Logout
- `res.cookie("jwt", "", getCookieOptions(0))`
- JWT cookie empty + expire.
- Logout account delete nahi karta.
- JWT server-side delete nahi hota; browser se token remove hota hai.

## GetMe
- `getMe` current user return karta hai.
- `req.user` protectRoute middleware se aata hai.
- Route order important:
  `protectRoute -> getMe`

Signup creates a new user account. It validates data, checks duplicate email, hashes password, saves user in DB, sets JWT cookie, and returns safe user data.

Login authenticates an existing user. It validates data, finds user by email, compares input password with stored hashed password, sets JWT cookie, and returns safe user data.

One-liner:
Signup creates a new user, login verifies an existing user.


# Auth Flow Diagrams

## Signup Flow

```text
POST /signup
    |
    v
signupSchema.safeParse(req.body)
    |
    |-- invalid data
    |       |
    |       v
    |   400 Bad Request
    |
    v
email.toLowerCase()
    |
    v
User.findOne({ email })
    |
    |-- user exists
    |       |
    |       v
    |   400 Email already exists
    |
    v
bcrypt.hash(password, 10)
    |
    v
User.create({ name, email, password: hashedPassword })
    |
    v
generateToken(user._id, res)
    |
    v
201 Created + safe user data






## login flow
POST /login
    |
    v
loginSchema.safeParse(req.body)
    |
    |-- invalid data
    |       |
    |       v
    |   400 Bad Request
    |
    v
email.toLowerCase()
    |
    v
User.findOne({ email })
    |
    |-- user not found
    |       |
    |       v
    |   400 Invalid credentials
    |
    v
bcrypt.compare(password, user.password)
    |
    |-- wrong password
    |       |
    |       v
    |   400 Invalid credentials
    |
    v
generateToken(user._id, res)
    |
    v
200 OK + safe user data







POST /logout
    |
    v
res.cookie("jwt", "", getCookieOptions(0))
    |
    v
JWT cookie clear / expire
    |
    v
200 Logout successful





GET /me
    |
    v
protectRoute middleware
    |
    v
verify JWT token
    |
    v
find user from DB
    |
    v
req.user = user
    |
    v
getMe controller
    |
    v
200 OK + current user