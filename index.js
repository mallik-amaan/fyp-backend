const express = require("express")
const path = require("path")
const env = require("dotenv")
const app = express()

//setting up the env file
env.config()
port  = process.env.PORT


app.use(express.json())

app.get('/',(req,res)=>{
    res.send("Amaan here")
});

//adding other routes
app.use('/auth',require(path.join(__dirname,"routes/auth.route.js")))
app.use('/user',require(path.join(__dirname,"routes/user.route.js")))



//setting up the port
app.listen(port,()=>{
    console.log(`Server started at port: ${port}`)
})