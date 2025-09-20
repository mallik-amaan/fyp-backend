const express = require("express")
const path = require("path")
const env = require("dotenv")
const app = express()
const port = 3000

env.config()
app.use(express.json())

app.get('/',(req,res)=>{
    res.send("Amaan here")
});

app.use('/auth',require(path.join(__dirname,"routes/auth.route.js")))

app.listen(port,()=>{
    console.log(`Server started at port: ${port}`)
})