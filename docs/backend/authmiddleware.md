# Auth Middleware Checkpoints

## 1. `protectRoute` ka main kaam kya hai? Aur `req.user = user` kyu set karte hain?

**Answer:**  
`protectRoute` ka main kaam protected route access karne se pehle current user ko authenticate karna hai.

Ye check karta hai:
- cookie me JWT token hai ya nahi
- token valid hai ya nahi
- token ke andar jo `userId` hai, wo DB me exist karta hai ya nahi

`req.user = user` isliye set karte hain taaki next controller ko current logged-in user directly mil jaye.

---

## 2. `req.cookies.jwt` me token kaha se aaya? Login/signup ke baad browser me kaise save hua?

**Answer:**  
Login/signup success hone ke baad backend `generateToken(user._id, res)` call karta hai.

`generateToken` JWT banata hai aur `res.cookie("jwt", token, options)` se browser me cookie save karta hai.

Baad me jab protected route hit hota hai, browser automatically cookie request ke saath bhejta hai. `cookieParser` us cookie ko read karke `req.cookies.jwt` me available karata hai.

---

## 3. `if (!token)` wale block me `return` kyu lagaya hai? Aur `401` status code ka matlab kya hota hai?

**Answer:**  
`return` isliye lagaya hai taaki response bhejne ke baad middleware ka neeche wala code execute na ho.

Agar `return` nahi hoga, toh token missing hone ke baad bhi `jwt.verify(token, secret)` chal sakta hai.

`401 Unauthorized` ka matlab user authenticated nahi hai. Ye server error nahi hai. Server error `5xx` hota hai.

---

## 4. `jwt.verify(token, process.env.JWT_SECRET)` kya check karta hai? Aur `decoded.userId` kyu important hai?

**Answer:**  
`jwt.verify()` check karta hai:
- token real hai ya fake
- token same `JWT_SECRET` se bana hai ya nahi
- token expire toh nahi hua
- token ke andar payload kya hai

`decoded.userId` important hai kyunki isi userId se DB me current user find hota hai.

---

## 5. `.select("-password")` kyu use kiya? Aur valid token hone ke baad bhi `User.findById()` kyu karna padta hai?

**Answer:**  
`.select("-password")` password hash ko user object se remove karne ke liye use hota hai.

Valid token hone ke baad bhi DB check isliye karte hain kyunki:
- user DB se delete ho chuka ho sakta hai
- token purane user ka ho sakta hai
- wrong database connected ho sakta hai
- user future me banned/deactivated ho sakta hai

JWT sirf userId ka proof deta hai. Actual user data DB se confirm hota hai.

---

## 6. `req.user = user` aur `next()` me difference kya hai?

**Answer:**  
`req.user = user` current logged-in user ko request object me attach karta hai.

`next()` Express ko bolta hai ki ab next middleware/controller run karo.

Simple:
- `req.user = user` → data attach karna
- `next()` → request ko aage bhejna

Agar `next()` nahi hoga, toh request middleware me hi atak jayegi.

---

## 7. `jwt.verify()` invalid token pe kya karta hai — `false` return karta hai ya error throw karta hai? Aur `try/catch` kyu zaroori hai?

**Answer:**  
`jwt.verify()` invalid token pe `false` return nahi karta. Ye error throw karta hai.

Isliye `try/catch` zaroori hai. Agar token fake, expired, tampered ya wrong secret se bana hua hai, toh catch block chalega aur `401 Unauthorized - Invalid token` response bhejega.

---

# Auth Middleware Workflow Diagram

```text
Protected route hit
        |
        v
protectRoute middleware starts
        |
        v
Read token from req.cookies.jwt
        |
        |-- No token?
        |       |
        |       v
        |   401 Unauthorized - No token
        |
        v
jwt.verify(token, JWT_SECRET)
        |
        |-- Invalid / expired / fake token?
        |       |
        |       v
        |   catch block
        |       |
        |       v
        |   401 Unauthorized - Invalid token
        |
        v
decoded.userId extracted
        |
        v
User.findById(decoded.userId).select("-password")
        |
        |-- User not found?
        |       |
        |       v
        |   401 Unauthorized - User not found
        |
        v
req.user = user
        |
        v
next()
        |
        v
Actual controller runs