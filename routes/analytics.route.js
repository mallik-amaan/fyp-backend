const crypto = require('crypto');
const express = require('express');
const supabase = require('../config/supabase.config');
const { type } = require('os');

const router = express.Router();


router.post('/sumbit-review',(req,res) => {
    try{
        const {passed,flagged} = req.body;
        console.log(`passed: ${passed}`)
        console.log(`flagged: ${flagged}`)

        
    }
    catch(error){

    }
    finally{

    }

router.post('/flagged-docs',(req,res)=>{
    
})

})
