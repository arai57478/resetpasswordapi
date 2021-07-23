require('dotenv').config();
const express=require("express");
const bodyParser = require("body-parser");
const ejs=require("ejs");
const mongoose=require("mongoose");
const bcrypt=require("bcrypt");
const crypto=require("crypto");
const jwt=require("jsonwebtoken");
const app=express();
const nodemailer = require("nodemailer");
const sendgridTransport = require('nodemailer-sendgrid-transport');
const saltRounds=10;
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));


mongoose.connect("mongodb://localhost:27017/ApiDB", {
  useNewUrlParser: true,useUnifiedTopology:true,useFindAndModify:false
});
const contentSchema=new mongoose.Schema({
    _id:mongoose.Schema.Types.ObjectId,
    username:String,
    password:String,
    email:String,
    resetToken:String,
    expireToken:Date
});
const User=mongoose.model("User",contentSchema);
const PostSchema=new mongoose.Schema({
    _id:mongoose.Schema.Types.ObjectId,
    postId:Number,
    title:String,
    des:String,
    photo:String,
    likes:[String],
    comments:
        [{
        text:String,
       commentedBy:String,
    }
    ] ,
    postedBy:String
},{timestamps:true});
const Post=mongoose.model("Post",PostSchema);


const transporter = nodemailer.createTransport(sendgridTransport({
    auth:{
      
        api_key:process.env.SENDGRID_API_KEY
    }
}))

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.route("/register")

.post(function(req,res){

    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        const newUser= new User({
            _id:new mongoose.Types.ObjectId,
            email:req.body.email,
            username:req.body.username,
            password:hash
        })
        User.findOne({username:newUser.username},function(err,foundUser){
            if(foundUser){
                res.send("Already registered ! try login");
            }else{ 
                newUser.save(function(err){
                    if(err){
                        console.log(err);
                    }else{
                        res.send("successfully registered");
                    }
                });
               
            }
        });
       
       
    });
   
});




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.route("/login")
.post(function(req,res){
    const userName=req.body.username;
    const userPassword=req.body.password;

User.findOne({username:userName},function(err,founduser){
    if(err){
        console.log(err);
    }else{
        if(founduser){
           
            bcrypt.compare(userPassword, founduser.password, function(err, result) {
                if(result===true){
                    res.send("your are logged in succefully");
                }else{
                    res.send("please try again wrong password ");
                }
            });
        }else{
            res.send("User Not found ");
        }
       
    }
})
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.route("/forgotpassword")
.post(function(req,res){
    crypto.randomBytes(32,(err,buffer)=>{
        if(err){
            console.log(err)
        }
        const token = buffer.toString("hex")
        User.findOne({email:req.body.email})
        .then(user=>{
            if(!user){
                return res.send("User doesnot exist! Please create a new account")
            }
            user.resetToken = token
            user.expireToken = Date.now() + 3600000
            user.save().then((result)=>{
                transporter.sendMail({
                    to:user.email,
                    from:"arai57478@gmail.com",
                    subject:"password reset",
                    html:`
                    <p>You requested for password reset</p>
                    <h5>click in this <a href="${req.body.email}/reset/${token}">link</a> to reset password</h5>
                    `
                })
                res.send("successful")
            })

        })
    })
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.route("/deleteUser")
.delete(function(req,res){
    const userName=req.body.username;
    const userPassword=req.body.password;
    User.findOneAndDelete({username:userName},function(err,foundUser){
        if(err){
            console.log(err);
        }else{
            if(foundUser){
               
                bcrypt.compare(userPassword, foundUser.password, function(err, result) {
                    if(result===true){
                        res.send("your have deleted your account succefully");
                    }else{
                        res.send("please try again wrong password ");
                    }
                });
            }else{
                res.send("User Not found ");
            }
        
    }
});
});

////////////////////////////////////////////////////////////////////////////////////////////POST/////////////////////////////////////////////////////////////////////////////////////


app.route("/post")
.post( function (req, res) {
    
    const newPost= new Post({
        _id:new mongoose.Types.ObjectId,
        title:req.body.title,
        des:req.body.des,
        photo:req.body.photo,
        postId:req.body.postId,
        postedBy:req.body.postedBy
    })
    User.findOne({username:req.body.postedBy},function(err,foundUser){
        if(foundUser){
            newPost.save(function(err){
                if(err){
                    console.log(err);
                }else{
                    res.send("successfully saved the post !");
                }
            });
        }else{ 
           res.send("Please sign up first to save the post ")
        }
    });
   
   
});
app.route("/post/:postId")
.get(function(req,res){
    const postId =req.params.postId;
    Post.findOne({postId:postId},function(err,foundPost){
        if(foundPost){
            res.send(foundPost);
        }else{
            res.send("no posts are matching");
        }
    });
})
.put(function(req,res){
    Post.update({postId:req.params.postId},{title:req.body.title, des:req.body.des,photo:req.body.photo},{overwrite:true},function(err){
        if(!err){
            res.send("successfully updated post");
        }else{
            console.log(err);
            res.send("no post find with such id");
        }
    });

})
.delete(function(req,res){
    const userPassword=req.body.password;
    Post.findOne({postId:req.params.postId},function(err,PostFound){
        if(PostFound){
            User.findOne({username:PostFound.postedBy},function(err,foundUser){
                if(foundUser){
               
                    bcrypt.compare(userPassword, foundUser.password, function(err, result) {
                        if(result===true){
                                             Post.findOneAndDelete({postId:req.params.postId},function(err){
                                                   if(!err){
                                                     res.send("successfully deleted");
                                                      }
                                                   else{
                                                      res.send(err);
                                                       }
                                                 });;
                        }
                        else{
                            res.send("please try again wrong password ");
                         }
                     });
                }
              else{
                  res.send("user not found");
                }
            });
        }
        else
        { 
         res.send("Post not Found ")
         }
     });
         
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.route("/:postId/like")
.put( function (req, res){
    const postId =req.params.postId;
    Post.findOne({postId:postId},function(err,PostFound){
        if(PostFound){
            if (!PostFound.likes.includes(PostFound.postedBy)){
            Post.findOneAndUpdate({postId:postId},{ $push: { likes : PostFound.postedBy}},function(err){
        if(!err)
        {
            res.send("liked");
        }
        else{
            res.send(err);
        }
    })
    } else{
        Post.findOneAndUpdate({postId:postId},{ $pull: { likes : postedBy}},function(err){
            if(!err)
            {
                res.send("disliked");
            }
            else{
                res.send(err);
            }
        })
    }
}else{
    res.send("post not found");
}
   
    })
});
  
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.route("/:postId/comment")
.put(function(req,res){
  
     Post.findOne({postId:req.params.postId},function(err,PostFound){
        if(PostFound){
                    const comment = 
                        {
                        text:req.body.text,
                        postedBy:PostFound.postedBy
                        };
                    Post.findOneAndUpdate({postId:req.params.postId},{ $push: { comments : comment}},function(err){
                        if(!err)
                        {
                            res.send("commented");
                        }
                        else{
                            res.send(err);
                        }
                });
        }else {
            res.send("sorry ! no post is been found with this id ")
        }
    });
});





app.listen(3000,function(){
    console.log("server started at port 3000");
});

