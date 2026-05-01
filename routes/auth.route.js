const express  = require("express")
const jwt = require("jsonwebtoken")
const supabaseClient = require("../config/supabase.config")
const crypto = require("crypto")
const { timeStamp } = require("console")
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
          password_hash: password,
          email: email,
          api_id: api[0]["id"],
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
    console.log("got a login request")
    const email = req.body["email"]
    const password = req.body["password"]

    const {data,error} = await supabaseClient.from('users').select(
        "id,username,email,password_hash"
    ).eq("email",email)
    console.log(data)
    console.log(error)
    if(data && data.length > 0){
        const user = data[0]
        console.log(user)
            if(user.password_hash != password){
          return res.send({
            "result":"false",
            "message":"Incorrect Email or Password."
        })
        }
        const accessToken = jwt.sign({ email: user["email"] }, process.env.ACCESS_SECRET, { expiresIn: "15m" })
        const refreshToken = jwt.sign({email: user["email"] },process.env.REFRESH_SECRET,{expiresIn:"7d"})

        //save the access and refresh token in db
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const { data: updatedUser, error: updateError } = await supabaseClient
        .from("refresh_tokens")
        .insert({
                user_id: user.id,
                token_hash: refreshToken,
                expires_at: expiresAt.toISOString(),
                
                });
        console.log(updateError)
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
            "message":"error occured while logging in."
        })    }
})

router.post("/refresh", async (req, res) => {
  const { refreshToken, refresh_token } = req.body;
  const token = refreshToken || refresh_token;
  if (!token) return res.status(401).json({ message: "Refresh token required" });

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_SECRET);

    const { data, error } = await supabaseClient
      .from("refresh_tokens")
      .select("user_id, token_hash")
      .eq("token_hash", token)
      .single();

    if (!data) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign({ email: decoded.email }, process.env.ACCESS_SECRET, { expiresIn: "15m" });
    const newRefreshToken = jwt.sign({ email: decoded.email }, process.env.REFRESH_SECRET, { expiresIn: "7d" });

    await supabaseClient.from("refresh_tokens")
      .update({ token_hash: newRefreshToken, expires_at: new Date(Date.now() + 7*24*60*60*1000) })
      .eq("token_hash", token);

    res.json({ access_token: newAccessToken, refresh_token: newRefreshToken });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});



const generateAPI = async (username) => {
  const startString = "ds"; // change this to your required prefix
  const apikey = `${startString}-${username.split(' ')[0]}-${crypto.randomBytes(12).toString("hex")}`;

  const { data, error } = await supabaseClient
    .from("apis")
    .insert([
      {
        api_key: apikey,
        // can be changed based on requirements
        limit: 1000,
      },
    ])
    .select();

  if (error) throw error;
  return data;
};

router.post("/validate", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        result: false,
        message: "Authorization token missing",
      });
    }

    const accessToken = authHeader.split(" ")[1];
    const decoded = jwt.verify(accessToken, process.env.ACCESS_SECRET);

    if (decoded.type !== "access") {
      return res.status(401).json({
        result: false,
        message: "Invalid token type",
      });
    }

    return res.status(200).json({
      result: true,
      email: decoded.email,
    });
  } catch (err) {
    return res.status(401).json({
      result: false,
      message: "Invalid or expired token",
    });
  }
});

router.post('/change-password',async (req,res)=>{
    const {id,oldPassword,newPassword} = req.body;
    console.log("change password request for id: "+id)
    console.log("old password: "+oldPassword)
    console.log("new password: "+newPassword)
    const {data,error} = await supabaseClient.from('users').select(
        "id,username,email,password_hash"
    ).eq("id",id)
    console.log("change password data")
    console.log(data) 
    console.log(error)
    if(data && data.length > 0){
        const user = data[0]
        console.log(user)
        if(user.password_hash != oldPassword){
          return res.send({
            "result":"false",
            "message":"Incorrect Email or Password."
        })
        }
        const {data:updateData,error:updateError} = await supabaseClient.from('users').update({
            "password_hash":newPassword
        }).eq("id",id)
        if(updateError){
            res.send({
                "result":"false",
                "message":"Error occured while updating password."
            })  
        }
        else{
            res.send({
                "result":"true",
                "message":"Password updated successfully."
            })  
        }
    }
    else{
 res.send({
            "result":"false",
            "message":"error occured while changing password."
        })    }
})

router.post('/update-profile', async (req, res) => {
  const { id, username } = req.body;

  if (!id || !username || !username.trim()) {
    return res.status(400).json({ result: false, message: 'User ID and name are required.' });
  }

  const { error } = await supabaseClient
    .from('users')
    .update({ username: username.trim() })
    .eq('id', id);

  if (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ result: false, message: 'Failed to update name.' });
  }

  return res.json({ result: true, username: username.trim() });
});

router.get('/:id/get-api-key',(req,res)=>{
  (async () => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).send({
          result: false,
          message: "User id is required.",
        });
      }

      // 1) Get user's api_id
      const { data: user, error: userError } = await supabaseClient
        .from("users")
        .select("api_id")
        .eq("id", id)
        .single();

      if (userError || !user || !user.api_id) {
        return res.status(404).send({
          result: false,
          message: "API key not found for this user.",
        });
      }

      // 2) Fetch API key from apis table
      const { data: api, error: apiError } = await supabaseClient
        .from("apis")
        .select("api_key")
        .eq("id", user.api_id)
        .single();

      if (apiError || !api || !api.api_key) {
        return res.status(404).send({
          result: false,
          message: "API key does not exist.",
        });
      }

      return res.status(200).send({
        result: true,
        apiKey: api.api_key,
      });
    } catch (err) {
      console.error("get-api-key error:", err);
      return res.status(500).send({
        result: false,
        message: "Unexpected server error.",
      });
    }
  })();
})
module.exports = router


