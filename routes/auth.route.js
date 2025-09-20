const express  = require("express")
const jwt = require("jsonwebtoken")
const router = express.Router()
const USERS = []
const REFRESH_TOKENS = []

//SignUp Route
router.post('/signup',(req,res)=>{
    username = req.body["username"]
    password = req.body["password"]
    email = req.body["email"]
    
    res.send({
        "result":"true",
        "name":"username",
        "email":"email",
        "api-key":"AIzA2957p05ufkndspoh94"
    
    })
})


// Login Route
router.post('/login',(req,res)=>{
    username = req.body["username"]
    password = req.body["password"]
    if(username=="Amaan" && password=="12345678"){
    
        const accessToken = jwt.sign({username},process.env.ACCESS_SECRET,{expiresIn:"15m"})
        const refreshToken = jwt.sign({username},process.env.REFRESH_SECRET,{expiresIn:"7d"})

        REFRESH_TOKENS.push(refreshToken)

        res.send({
            "result":"true",
            "access":accessToken,
            "refresh":refreshToken
        })
    }
    else{
 res.send({
            "result":"false"
        })    }
})

// Refresh
router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || !REFRESH_TOKENS.includes(refreshToken)) {
    return res.status(403).json({ message: "Refresh token invalid" });
  }

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid refresh token" });

    const newAccessToken = jwt.sign({ username: user.username }, process.env.ACCESS_SECRET, { expiresIn: "15m" });
    res.json({ accessToken: newAccessToken });
  });
});

module.exports = router