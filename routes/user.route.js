const express = require("express")
const authenticateToken = require("../config/middleware/auth.middleware")
const info_router = express.Router()

//This route will provide the user info to frontend

router.get('/info',authenticateToken,(req,res)=>{
    console.log("user-info "+req.user )
})

module.exports = info_router