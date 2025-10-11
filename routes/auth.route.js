const express  = require("express")
const jwt = require("jsonwebtoken")
const supabaseClient = require("../config/supabase.config")
const crypto = require("crypto")
const router = express.Router()


//SignUp Route
// SignUp Route
router.post('/signup', async (req, res) => {
  try {
    const email = req.body["email"];
    const password = req.body["password"];
    const username = req.body["username"];

    // 1️⃣ Check if user already exists
    const { data: existingUser, error: fetchError } = await supabaseClient
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(200).send({
        result: false,
        message: "Email already exists. Please use a different email.",
      });
    }

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 means "no rows found" — ignore that
      console.error("Error checking existing user:", fetchError);
      return res.status(500).send({
        result: false,
        message: "Error checking existing user.",
      });
    }

    // 2️⃣ Generate API and insert new user
    const api = await generateAPI(username);

    const { data: insertedUser, error: insertError } = await supabaseClient
      .from("users")
      .insert([
        {
          username: username,
          password: password,
          email: email,
          api: api[0]["id"],
        },
      ])
      .select(); // optional: return inserted data

    if (insertError) {
      console.error("Error inserting user:", insertError);
      return res.status(500).send({
        result: false,
        message: "Failed to create user.",
      });
    }

    // 3️⃣ Success
    return res.send({
      result: true,
      name: username,
      email: email,
      "api-key": api[0]["api_key"],
    });
  } catch (err) {
    console.error("Unexpected signup error:", err);
    res.status(500).send({
      result: false,
      message: "Unexpected server error.",
    });
  }
});



// Login Route
router.post('/login',async (req,res)=>{
    email = req.body["email"]
    password = req.body["password"]

    const {data,error} = await supabaseClient.from('users').select(
        "id,username,email,password"
    ).eq("email",email)

    if(data && data.length > 0){
        const user = data[0]
        console.log(user)
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
                result:false,
                message:"failed to save tokens to db"
            })
        }


        res.send({
            "result":true,
            "access":accessToken,
            "id":user.id.toString(),
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

