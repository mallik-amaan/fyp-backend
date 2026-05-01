const express = require("express")
const path = require("path")
const env = require("dotenv")
const cors = require("cors")
const app = express()

//setting up the env file
env.config()
const port = process.env.PORT || 3000

// CORS for local development: reflect request origin and allow credentials
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.get('/',(req,res)=>{
    res.send("The backend server is running!!!")
});

//adding other routes
app.use('/auth',require(path.join(__dirname,"routes/auth.route.js")))
app.use('/user',require(path.join(__dirname,"routes/user.route.js")))
app.use('/oauth',require(path.join(__dirname,"routes/oauth2.route.js")))
app.use('/upload',require(path.join(__dirname,'routes/upload.route.js')))
app.use('/docs',require(path.join(__dirname,'routes/docs.route.js')))
app.use('/analytics',require(path.join(__dirname,'routes/analytics.route.js')))
app.use('/generate',require(path.join(__dirname,'routes/generate.route.js')))
app.use('/requests',require(path.join(__dirname,'routes/requests.route.js')))
//setting up the port
app.listen(port,()=>{
    console.log(`Server started at port: ${port}`)
})

