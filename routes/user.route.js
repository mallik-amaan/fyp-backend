const express = require("express")
const authenticateToken = require("../config/middleware/auth.middleware")
const router = express.Router()

//This route will provide the user info to frontend

router.post('/get-dashboard-stats',(req,res)=>{
    const {id} = req.body;
    console.log("user-info "+req.user)
    res.send({
        "generatedDocs": "25",
        "requestedDocs":"30",
        "flaggedDocs":"2",
        "successRatio":"90%",
        "processingQueue":"3",
        "pendingReview":"5",
        "verifiedToday":"10"
    })
})


module.exports = router