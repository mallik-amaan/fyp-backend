const express = require("express")
const path = require("path")
const env = require("dotenv")
const cors = require("cors")
const app = express()

//setting up the env file
env.config()
const port = process.env.PORT || 3000

const allowedOrigins = [
  'https://doc-synthesis.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // handle preflight for all routes (Express 5 compatible)

// Stripe webhook needs raw body — must be registered before express.json()
app.use('/stripe/webhook', express.raw({ type: 'application/json' }))
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
app.use('/redaction',require(path.join(__dirname,'routes/redaction.route.js')))
app.use('/usage',require(path.join(__dirname,'routes/usage.route.js')))
app.use('/stripe',require(path.join(__dirname,'routes/stripe.route.js')))
//setting up the port
app.listen(port,()=>{
    console.log(`Server started at port: ${port}`)
})

