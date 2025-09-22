const express  = require("express")
const jwt = require("jsonwebtoken")
const supabaseClient = require("../config/supabase.config")
const crypto = require("crypto")
const router = express.Router()


//SignUp Route
router.post('/signup', async (req,res)=>{
    username = req.body["username"]
    password = req.body["password"]
    email = req.body["email"]

    api = await generateAPI(username)
    //creating a new user in db
    response = await supabaseClient.from('users').insert(
     [{
        "username":username,
        "password":password,
        "email":email,
        "api": api[0]["id"]
        }]
    )

        console.log(`response: ${response}`)
        res.send({
        "result":"true",
        "name":username,
        "email":email,
        "api-key": api[0]["api_key"]
    })
})


// Login Route
router.post('/login',async (req,res)=>{
    email = req.body["email"]
    password = req.body["password"]

    const {data,error} = await supabaseClient.from('users').select(
        "id,username,email,password"
    ).eq("email",email)

    if(data && data.length > 0){
        const user = data[0]
        const accessToken = jwt.sign({ email: user["email"] }, process.env.ACCESS_SECRET, { expiresIn: "15m" })
        const refreshToken = jwt.sign({email: user["email"] },process.env.REFRESH_SECRET,{expiresIn:"7d"})

        //save the access and refresh token in db
        const { data: updatedUser, error: updateError } = await supabaseClient
        .from("users")
        .update({
                access_token: accessToken,
                refresh_token: refreshToken
                })
                .eq("id", user.id);

        if(updateError){
            res.send({
                result:"false",
                message:"failed to save tokens to db"
            })
        }


        res.send({
            "result":"true",
            "access":accessToken,
            "refresh":refreshToken,
            "email":user["email"],
            "username":user["username"],         
        })
    }
    else{
 res.send({
            "result":"false",
            "message":"error occured while logging in, please try again."
        })    }
})

// Refresh Route
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token required" });
  }

  try {
    // Verify token signature & expiration
    jwt.verify(refreshToken, process.env.REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired refresh token" });
      }

      // Check refresh token in DB
      const { data, error } = await supabaseClient
        .from("users")
        .select("id, email, username, refresh_token")
        .eq("email", decoded.email)
        .single();

      if (error || !data) {
        return res.status(403).json({ message: "User not found" });
      }

      if (data.refresh_token !== refreshToken) {
        return res.status(403).json({ message: "Refresh token mismatch" });
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        { email: data.email },
        process.env.ACCESS_SECRET,
        { expiresIn: "15m" }
      );

      res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router


const generateAPI = async (username) => {
    const apikey = crypto.randomBytes(32).toString("hex");
    const {data,error} =await supabaseClient.from("apis").insert([{
        "api_key":apikey,
        //can be changed based on requirements
        "limit":1000,
    }]).select()

    return data
}

