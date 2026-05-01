const express  = require("express")
const jwt = require("jsonwebtoken")
const supabaseClient = require("../config/supabase.config")
const crypto = require("crypto")
const { Resend } = require("resend")
const router = express.Router()

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex")
}

async function sendOTPEmail(email, otp, purpose) {
  const isReset = purpose === "reset_password"
  const subject = isReset ? "Reset your password — DocSynth" : "Verify your email — DocSynth"
  const action  = isReset ? "reset your password" : "verify your email address"

  await resend.emails.send({
    from: `DocSynth <${FROM_EMAIL}>`,
    to:   [email],
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
          <div style="background:#6366f1;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center">
            <span style="color:#fff;font-weight:700;font-size:13px">D</span>
          </div>
          <span style="font-weight:600;font-size:14px;color:#111">DocSynth</span>
        </div>
        <h2 style="font-size:20px;font-weight:600;color:#111;margin:0 0 8px">Your verification code</h2>
        <p style="font-size:14px;color:#6b7280;margin:0 0 24px">Use the code below to ${action}. It expires in 10 minutes.</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#111;font-family:monospace">${otp}</span>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin:0">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  })
}

async function storeOTP(email, otp, purpose) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  // Invalidate any prior unused OTPs for this email+purpose
  await supabaseClient
    .from("otps")
    .update({ used: true })
    .eq("email", email)
    .eq("purpose", purpose)
    .eq("used", false)

  const { error } = await supabaseClient.from("otps").insert({
    email,
    otp_hash:   hashOTP(otp),
    purpose,
    expires_at: expiresAt,
    used:       false,
  })
  if (error) throw error
}

async function verifyStoredOTP(email, otp, purpose) {
  const { data, error } = await supabaseClient
    .from("otps")
    .select("id, expires_at, used")
    .eq("email", email)
    .eq("otp_hash", hashOTP(otp))
    .eq("purpose", purpose)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return { valid: false, reason: "Invalid OTP" }
  if (new Date(data.expires_at) < new Date()) return { valid: false, reason: "OTP has expired" }

  await supabaseClient.from("otps").update({ used: true }).eq("id", data.id)
  return { valid: true }
}

// ─── Signup ───────────────────────────────────────────────────────────────────

router.post("/signup", async (req, res) => {
  try {
    const { email, password, username } = req.body

    const { data: existingUser } = await supabaseClient
      .from("users")
      .select("id")
      .eq("email", email)
      .single()

    if (existingUser) {
      return res.status(200).json({ result: false, message: "Email already exists. Please use a different email." })
    }

    const api = await generateAPI(username)

    const { error: insertError } = await supabaseClient.from("users").insert([{
      username,
      password_hash:  password,
      email,
      api_id:         api[0]["id"],
      email_verified: false,
    }])

    if (insertError) {
      console.error("Error inserting user:", insertError)
      return res.status(500).json({ result: false, message: "Failed to create user." })
    }

    const otp = generateOTP()
    await storeOTP(email, otp, "verify_email")
    await sendOTPEmail(email, otp, "verify_email")

    return res.json({ result: true, requiresVerification: true })
  } catch (err) {
    console.error("Unexpected signup error:", err)
    res.status(500).json({ result: false, message: "Unexpected server error." })
  }
})

// ─── Login ────────────────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const { email, password } = req.body

  const { data } = await supabaseClient
    .from("users")
    .select("id, username, email, password_hash, email_verified")
    .eq("email", email)

  if (!data || data.length === 0) {
    return res.json({ result: "false", message: "Incorrect Email or Password." })
  }

  const user = data[0]

  if (user.password_hash !== password) {
    return res.json({ result: "false", message: "Incorrect Email or Password." })
  }

  if (user.email_verified === false) {
    return res.status(200).json({
      result: false,
      message: "Email not verified. Please verify your email before logging in.",
      requiresVerification: true,
      email,
    })
  }

  const accessToken  = jwt.sign({ email: user.email }, process.env.ACCESS_SECRET,  { expiresIn: "15m" })
  const refreshToken = jwt.sign({ email: user.email }, process.env.REFRESH_SECRET, { expiresIn: "7d"  })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { error: tokenError } = await supabaseClient.from("refresh_tokens").insert({
    user_id:    user.id,
    token_hash: refreshToken,
    expires_at: expiresAt.toISOString(),
  })

  if (tokenError) {
    return res.json({ result: false, message: "Failed to save tokens to db" })
  }

  res.json({
    result:   true,
    access:   accessToken,
    id:       user.id.toString(),
    refresh:  refreshToken,
    email:    user.email,
    username: user.username,
  })
})

// ─── Send OTP (signup verify resend + forgot password) ───────────────────────

router.post("/send-otp", async (req, res) => {
  const { email, purpose } = req.body

  if (!email || !["verify_email", "reset_password"].includes(purpose)) {
    return res.status(400).json({ result: false, message: "email and valid purpose are required" })
  }

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("id, email_verified")
      .eq("email", email)
      .single()

    if (!user) {
      // Don't leak whether the email exists for reset_password
      return res.json({ result: true })
    }

    if (purpose === "verify_email" && user.email_verified) {
      return res.json({ result: false, message: "Email is already verified." })
    }

    const otp = generateOTP()
    await storeOTP(email, otp, purpose)
    await sendOTPEmail(email, otp, purpose)

    res.json({ result: true })
  } catch (err) {
    console.error("send-otp error:", err)
    res.status(500).json({ result: false, message: "Failed to send OTP." })
  }
})

// ─── Verify OTP ───────────────────────────────────────────────────────────────

router.post("/verify-otp", async (req, res) => {
  const { email, otp, purpose } = req.body

  if (!email || !otp || !purpose) {
    return res.status(400).json({ result: false, message: "email, otp, and purpose are required" })
  }

  try {
    const { valid, reason } = await verifyStoredOTP(email, otp, purpose)

    if (!valid) {
      return res.status(400).json({ result: false, message: reason })
    }

    if (purpose === "verify_email") {
      await supabaseClient.from("users").update({ email_verified: true }).eq("email", email)
      return res.json({ result: true })
    }

    if (purpose === "reset_password") {
      const resetToken = jwt.sign({ email, purpose: "reset" }, process.env.ACCESS_SECRET, { expiresIn: "10m" })
      return res.json({ result: true, reset_token: resetToken })
    }

    res.json({ result: true })
  } catch (err) {
    console.error("verify-otp error:", err)
    res.status(500).json({ result: false, message: "Failed to verify OTP." })
  }
})

// ─── Reset Password ───────────────────────────────────────────────────────────

router.post("/reset-password", async (req, res) => {
  const { reset_token, new_password } = req.body

  if (!reset_token || !new_password) {
    return res.status(400).json({ result: false, message: "reset_token and new_password are required" })
  }

  try {
    let decoded
    try {
      decoded = jwt.verify(reset_token, process.env.ACCESS_SECRET)
    } catch {
      return res.status(400).json({ result: false, message: "Reset link has expired. Please request a new one." })
    }

    if (decoded.purpose !== "reset") {
      return res.status(400).json({ result: false, message: "Invalid reset token." })
    }

    const { error } = await supabaseClient
      .from("users")
      .update({ password_hash: new_password })
      .eq("email", decoded.email)

    if (error) throw error

    res.json({ result: true })
  } catch (err) {
    console.error("reset-password error:", err)
    res.status(500).json({ result: false, message: "Failed to reset password." })
  }
})

// ─── Refresh ──────────────────────────────────────────────────────────────────

router.post("/refresh", async (req, res) => {
  const { refreshToken, refresh_token } = req.body
  const token = refreshToken || refresh_token
  if (!token) return res.status(401).json({ message: "Refresh token required" })

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_SECRET)

    const { data } = await supabaseClient
      .from("refresh_tokens")
      .select("user_id, token_hash")
      .eq("token_hash", token)
      .single()

    if (!data) return res.status(403).json({ message: "Invalid refresh token" })

    const newAccessToken  = jwt.sign({ email: decoded.email }, process.env.ACCESS_SECRET,  { expiresIn: "15m" })
    const newRefreshToken = jwt.sign({ email: decoded.email }, process.env.REFRESH_SECRET, { expiresIn: "7d"  })

    await supabaseClient
      .from("refresh_tokens")
      .update({ token_hash: newRefreshToken, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
      .eq("token_hash", token)

    res.json({ access_token: newAccessToken, refresh_token: newRefreshToken })
  } catch (err) {
    console.error(err)
    res.status(401).json({ message: "Invalid or expired refresh token" })
  }
})

// ─── Validate ─────────────────────────────────────────────────────────────────

router.post("/validate", (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ result: false, message: "Authorization token missing" })
    }
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.ACCESS_SECRET)
    return res.status(200).json({ result: true, email: decoded.email })
  } catch {
    return res.status(401).json({ result: false, message: "Invalid or expired token" })
  }
})

// ─── Change Password ──────────────────────────────────────────────────────────

router.post("/change-password", async (req, res) => {
  const { id, oldPassword, newPassword } = req.body
  const { data } = await supabaseClient
    .from("users")
    .select("id, password_hash")
    .eq("id", id)

  if (!data || data.length === 0) {
    return res.json({ result: "false", message: "error occured while changing password." })
  }
  const user = data[0]
  if (user.password_hash !== oldPassword) {
    return res.json({ result: "false", message: "Incorrect current password." })
  }
  const { error } = await supabaseClient.from("users").update({ password_hash: newPassword }).eq("id", id)
  if (error) {
    return res.json({ result: "false", message: "Error occured while updating password." })
  }
  res.json({ result: "true", message: "Password updated successfully." })
})

// ─── Update Profile ───────────────────────────────────────────────────────────

router.post("/update-profile", async (req, res) => {
  const { id, username } = req.body
  if (!id || !username?.trim()) {
    return res.status(400).json({ result: false, message: "User ID and name are required." })
  }
  const { error } = await supabaseClient.from("users").update({ username: username.trim() }).eq("id", id)
  if (error) {
    console.error("Update profile error:", error)
    return res.status(500).json({ result: false, message: "Failed to update name." })
  }
  return res.json({ result: true, username: username.trim() })
})

// ─── Get API Key ──────────────────────────────────────────────────────────────

router.get("/:id/get-api-key", async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ result: false, message: "User id is required." })

    const { data: user, error: userError } = await supabaseClient
      .from("users").select("api_id").eq("id", id).single()

    if (userError || !user?.api_id) {
      return res.status(404).json({ result: false, message: "API key not found for this user." })
    }

    const { data: api, error: apiError } = await supabaseClient
      .from("apis").select("api_key").eq("id", user.api_id).single()

    if (apiError || !api?.api_key) {
      return res.status(404).json({ result: false, message: "API key does not exist." })
    }

    return res.status(200).json({ result: true, apiKey: api.api_key })
  } catch (err) {
    console.error("get-api-key error:", err)
    return res.status(500).json({ result: false, message: "Unexpected server error." })
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateAPI = async (username) => {
  const apikey = `ds-${username.split(" ")[0]}-${crypto.randomBytes(12).toString("hex")}`
  const { data, error } = await supabaseClient
    .from("apis")
    .insert([{ api_key: apikey, limit: 1000 }])
    .select()
  if (error) throw error
  return data
}

module.exports = router
