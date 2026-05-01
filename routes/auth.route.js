const express  = require("express")
const jwt = require("jsonwebtoken")
const supabaseClient = require("../config/supabase.config")
const crypto = require("crypto")
const nodemailer = require("nodemailer")
const router = express.Router()

// ─── Environment check (logged once at startup) ──────────────────────────────
console.log("[auth] GMAIL_USER present:", !!process.env.GMAIL_USER)
console.log("[auth] GMAIL_APP_PASSWORD present:", !!process.env.GMAIL_APP_PASSWORD)
console.log("[auth] ACCESS_SECRET present:", !!process.env.ACCESS_SECRET)
console.log("[auth] REFRESH_SECRET present:", !!process.env.REFRESH_SECRET)

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex")
}

async function sendOTPEmail(email, otp, purpose) {
  console.log(`[sendOTPEmail] to=${email} purpose=${purpose} from=${process.env.GMAIL_USER}`)

  const isReset = purpose === "reset_password"
  const subject = isReset ? "Reset your password — DocSynth" : "Verify your email — DocSynth"
  const action  = isReset ? "reset your password" : "verify your email address"

  const info = await mailer.sendMail({
    from:    `DocSynth <${process.env.GMAIL_USER}>`,
    to:      email,
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

  console.log(`[sendOTPEmail] delivered messageId=${info.messageId} to=${email}`)
}

async function storeOTP(email, otp, purpose) {
  console.log(`[storeOTP] email=${email} purpose=${purpose}`)

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: invalidateError } = await supabaseClient
    .from("otps")
    .update({ used: true })
    .eq("email", email)
    .eq("purpose", purpose)
    .eq("used", false)

  if (invalidateError) {
    console.warn("[storeOTP] failed to invalidate old OTPs:", invalidateError.message)
  }

  const { error } = await supabaseClient.from("otps").insert({
    email,
    otp_hash:   hashOTP(otp),
    purpose,
    expires_at: expiresAt,
    used:       false,
  })

  if (error) {
    console.error("[storeOTP] insert failed:", error.message, "code:", error.code)
    throw error
  }

  console.log(`[storeOTP] stored successfully for email=${email} expires=${expiresAt}`)
}

async function verifyStoredOTP(email, otp, purpose) {
  console.log(`[verifyStoredOTP] email=${email} purpose=${purpose}`)

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

  if (error) {
    console.warn(`[verifyStoredOTP] DB lookup failed: ${error.message} (code: ${error.code})`)
    return { valid: false, reason: "Invalid OTP" }
  }

  if (!data) {
    console.warn(`[verifyStoredOTP] no matching OTP found for email=${email} purpose=${purpose}`)
    return { valid: false, reason: "Invalid OTP" }
  }

  const now      = new Date()
  const expiresAt = new Date(data.expires_at)
  if (expiresAt < now) {
    console.warn(`[verifyStoredOTP] OTP expired at ${data.expires_at} (now=${now.toISOString()})`)
    return { valid: false, reason: "OTP has expired" }
  }

  const { error: markUsedError } = await supabaseClient
    .from("otps")
    .update({ used: true })
    .eq("id", data.id)

  if (markUsedError) {
    console.warn("[verifyStoredOTP] failed to mark OTP as used:", markUsedError.message)
  }

  console.log(`[verifyStoredOTP] OTP verified successfully for email=${email}`)
  return { valid: true }
}

// ─── Signup ───────────────────────────────────────────────────────────────────

router.post("/signup", async (req, res) => {
  const { email, username } = req.body
  console.log(`[signup] attempt email=${email} username=${username}`)

  try {
    const { data: existingUser } = await supabaseClient
      .from("users")
      .select("id")
      .eq("email", email)
      .single()

    if (existingUser) {
      console.log(`[signup] duplicate email=${email}`)
      return res.status(200).json({ result: false, message: "Email already exists. Please use a different email." })
    }

    console.log(`[signup] generating API key for username=${username}`)
    const api = await generateAPI(username)

    const { error: insertError } = await supabaseClient.from("users").insert([{
      username,
      password_hash:  req.body.password,
      email,
      api_id:         api[0]["id"],
      email_verified: false,
    }])

    if (insertError) {
      console.error("[signup] DB insert failed:", insertError.message, "code:", insertError.code)
      return res.status(500).json({ result: false, message: "Failed to create user." })
    }

    // Assign basic plan usage record
    const { data: basicPlan } = await supabaseClient.from("plans").select("id").eq("name", "basic").single()
    if (basicPlan) {
      const { data: newUser } = await supabaseClient.from("users").select("id").eq("email", email).single()
      if (newUser) {
        await supabaseClient.from("user_usage").insert({
          user_id: newUser.id,
          plan_id: basicPlan.id,
          generation_requests_used: 0,
          redactions_used: 0,
          docs_generated_used: 0,
          period_start: new Date().toISOString(),
        })
      }
    }

    console.log(`[signup] user created email=${email} — storing and sending OTP`)
    const otp = generateOTP()
    await storeOTP(email, otp, "verify_email")
    await sendOTPEmail(email, otp, "verify_email")

    console.log(`[signup] complete email=${email}`)
    return res.json({ result: true, requiresVerification: true })
  } catch (err) {
    console.error("[signup] unexpected error:", err?.message || err)
    res.status(500).json({ result: false, message: "Unexpected server error." })
  }
})

// ─── Login ────────────────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const { email } = req.body
  console.log(`[login] attempt email=${email}`)

  const { data, error: fetchError } = await supabaseClient
    .from("users")
    .select("id, username, email, password_hash, email_verified")
    .eq("email", email)

  if (fetchError) {
    console.error("[login] DB fetch error:", fetchError.message)
  }

  if (!data || data.length === 0) {
    console.log(`[login] no user found for email=${email}`)
    return res.json({ result: "false", message: "Incorrect Email or Password." })
  }

  const user = data[0]

  if (user.password_hash !== req.body.password) {
    console.log(`[login] wrong password for email=${email}`)
    return res.json({ result: "false", message: "Incorrect Email or Password." })
  }

  if (user.email_verified === false) {
    console.log(`[login] unverified email=${email} — blocking login`)
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
    console.error("[login] failed to save refresh token:", tokenError.message)
    return res.json({ result: false, message: "Failed to save tokens to db" })
  }

  console.log(`[login] success userId=${user.id} email=${email}`)
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
  console.log(`[send-otp] request email=${email} purpose=${purpose}`)

  if (!email || !["verify_email", "reset_password"].includes(purpose)) {
    console.warn(`[send-otp] bad request — email=${email} purpose=${purpose}`)
    return res.status(400).json({ result: false, message: "email and valid purpose are required" })
  }

  try {
    const { data: user, error: fetchError } = await supabaseClient
      .from("users")
      .select("id, email_verified")
      .eq("email", email)
      .single()

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("[send-otp] DB fetch error:", fetchError.message)
    }

    if (!user) {
      console.log(`[send-otp] email=${email} not found in DB — returning silent success (${purpose})`)
      return res.json({ result: true })
    }

    if (purpose === "verify_email" && user.email_verified) {
      console.log(`[send-otp] email=${email} already verified — skipping`)
      return res.json({ result: false, message: "Email is already verified." })
    }

    console.log(`[send-otp] generating OTP for email=${email}`)
    const otp = generateOTP()
    await storeOTP(email, otp, purpose)
    await sendOTPEmail(email, otp, purpose)

    console.log(`[send-otp] success email=${email} purpose=${purpose}`)
    res.json({ result: true })
  } catch (err) {
    console.error("[send-otp] error:", err?.message || err)
    res.status(500).json({ result: false, message: "Failed to send OTP." })
  }
})

// ─── Verify OTP ───────────────────────────────────────────────────────────────

router.post("/verify-otp", async (req, res) => {
  const { email, otp, purpose } = req.body
  console.log(`[verify-otp] request email=${email} purpose=${purpose} otp_length=${otp?.length}`)

  if (!email || !otp || !purpose) {
    console.warn(`[verify-otp] missing fields — email=${!!email} otp=${!!otp} purpose=${!!purpose}`)
    return res.status(400).json({ result: false, message: "email, otp, and purpose are required" })
  }

  try {
    const { valid, reason } = await verifyStoredOTP(email, otp, purpose)

    if (!valid) {
      console.log(`[verify-otp] invalid — reason="${reason}" email=${email} purpose=${purpose}`)
      return res.status(400).json({ result: false, message: reason })
    }

    if (purpose === "verify_email") {
      const { error: updateError } = await supabaseClient
        .from("users")
        .update({ email_verified: true })
        .eq("email", email)

      if (updateError) {
        console.error("[verify-otp] failed to mark email_verified:", updateError.message)
        return res.status(500).json({ result: false, message: "Failed to verify email." })
      }

      console.log(`[verify-otp] email verified successfully email=${email}`)
      return res.json({ result: true })
    }

    if (purpose === "reset_password") {
      const resetToken = jwt.sign({ email, purpose: "reset" }, process.env.ACCESS_SECRET, { expiresIn: "10m" })
      console.log(`[verify-otp] reset token issued for email=${email}`)
      return res.json({ result: true, reset_token: resetToken })
    }

    res.json({ result: true })
  } catch (err) {
    console.error("[verify-otp] unexpected error:", err?.message || err)
    res.status(500).json({ result: false, message: "Failed to verify OTP." })
  }
})

// ─── Reset Password ───────────────────────────────────────────────────────────

router.post("/reset-password", async (req, res) => {
  console.log("[reset-password] request received")

  const { reset_token, new_password } = req.body

  if (!reset_token || !new_password) {
    console.warn("[reset-password] missing reset_token or new_password")
    return res.status(400).json({ result: false, message: "reset_token and new_password are required" })
  }

  try {
    let decoded
    try {
      decoded = jwt.verify(reset_token, process.env.ACCESS_SECRET)
    } catch (jwtErr) {
      console.warn("[reset-password] JWT verification failed:", jwtErr?.message)
      return res.status(400).json({ result: false, message: "Reset link has expired. Please request a new one." })
    }

    if (decoded.purpose !== "reset") {
      console.warn("[reset-password] wrong token purpose:", decoded.purpose)
      return res.status(400).json({ result: false, message: "Invalid reset token." })
    }

    console.log(`[reset-password] updating password for email=${decoded.email}`)
    const { error } = await supabaseClient
      .from("users")
      .update({ password_hash: new_password })
      .eq("email", decoded.email)

    if (error) {
      console.error("[reset-password] DB update failed:", error.message)
      throw error
    }

    console.log(`[reset-password] success email=${decoded.email}`)
    res.json({ result: true })
  } catch (err) {
    console.error("[reset-password] unexpected error:", err?.message || err)
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
