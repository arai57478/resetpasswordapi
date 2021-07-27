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
            
            jwt.sign({username:founduser.username,id:founduser._id}, process.env.JWT_KEY, { expiresIn: '1h' }, (err, token) => {
                res.json({
                    message:"your are logged in succefully",
                  token
                });
              });
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
.post(verifyToken,function(req,res){
    jwt.verify(req.token, process.env.JWT_KEY, (err, authData) => {
        if(err) {
          res.sendStatus(403);
        } else {
    crypto.randomBytes(32,(err,buffer)=>{
        if(err){
            console.log(err)
        }
        const token = buffer.toString("hex")
        User.findOne({email:req.body.email})
        .then(user=>{
            if(!user){
                return res.send("User doesnot exist! Please create a new account");
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
}
});
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.route("/deleteUser")
.delete(verifyToken,function(req,res){
    const userName=req.body.username;
    const userPassword=req.body.password;
    jwt.verify(req.token, process.env.JWT_KEY, (err, authData) => {
        if(err) {
          res.sendStatus(403);
        } else {
            User.findOneAndDelete({username:userName},function(err,foundUser){
                if(err){
                    console.log(err);
                }else{
                    if(foundUser){
                        if(userName===authData.username)
                        {
                       
                        bcrypt.compare(userPassword, foundUser.password, function(err, result) {
                            if(result===true){
                             
                                      res.json({
                                        message: "your have deleted your account succefully",
                                        authData
                                      });
                                    }
                                 
                               
                            else{
                                res.send("please try again wrong password ");
                            }
                        });
                    }
                    else{
                        res.send("username does not match with logged in username,please sign in with correct credentials to delete account  ");
                    }
                    }else{
                        res.send("User Not found ");
                    }
                
            }
        });
        }
      });
  
   
});

////////////////////////////////////////////////////////////////////////////////////////////POST/////////////////////////////////////////////////////////////////////////////////////


app.route("/post")
.post(verifyToken,function (req, res) {
    jwt.verify(req.token, process.env.JWT_KEY, (err, authData) => {
        if(err) {
          res.sendStatus(403);
        } else {
    
    const newPost= new Post({
        _id:new mongoose.Types.ObjectId,
        title:req.body.title,
        des:req.body.des,
        photo:req.body.photo,
        postId:req.body.postId,
        postedBy:authData.username
    })
   
    Post.findOne({postId:newPost.postId},function(err,foundpost){
        if(foundpost){
            res.send("post with this postid is alredy present");
        }else  {  
         User.findOne({username:authData.username},function(err,foundUser){
        if(foundUser){
           
                    newPost.save(function(err){
                        if(err){
                            console.log(err);
                        }else{
                            res.json({
                                message: "successfully saved the post !",
                              }); 
                           
                        }
                  
                });
            }else{ 
           res.send("Please sign up/sign in  first to save the post ");
        }
    });
}
    });
}
   
});
});
app.route("/post/:postId")
.get(verifyToken,function(req,res){
    jwt.verify(req.token, process.env.JWT_KEY, (err) => {
        if(err) {
          res.sendStatus(403);
        } else {
    const postId =req.params.postId;
    Post.findOne({postId:postId},function(err,foundPost){
        if(foundPost){
            res.send(foundPost);
        }else{
            res.send("no posts are matching");
        }
    });
   }
    })
})
.put(verifyToken,function(req,res){
    jwt.verify(req.token, process.env.JWT_KEY, (err,authData) => {
        if(err) {
          res.sendStatus(403);
        } else {
    Post.findOne({postId:req.params.postId},function(err,foundPost){
        if(foundPost){
            if(foundPost.postedBy===authData.username){
    Post.update({postId:req.params.postId},{title:req.body.title, des:req.body.des,photo:req.body.photo,postId:req.params.postId,postedBy:foundPost.postedBy},{overwrite:true},function(err){
        if(!err){
            res.send("successfully updated post");
        }else{
            console.log(err);
            res.send("no post find with such id");
        }
    });
}
else{
    res.send("please sign in to update the post");
}
}
else{
    res.send("no post find with such id");
}
    })
}
    })
})
.delete(verifyToken,function(req,res){
    const userPassword=req.body.password;
    jwt.verify(req.token, process.env.JWT_KEY, (err,authData) => {
        if(err) {
          res.sendStatus(403);
        } else {
    
    Post.findOne({postId:req.params.postId},function(err,PostFound){
        if(PostFound){
            User.findOne({username:PostFound.postedBy},function(err,foundUser){
                if(foundUser){   if(foundPost.postedBy===authData.username){
               
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
                    res.send("please login to delete the post");
                }
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
    }
    })   ;    
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.route("/:postId/like")
.put(verifyToken,function (req, res){
    jwt.verify(req.token, process.env.JWT_KEY, (err,authData) => {
        if(err) {
          res.sendStatus(403);
        } else {
    const postId =req.params.postId;
    Post.findOne({postId:postId},function(err,PostFound){
        if(PostFound){
            if(PostFound.postedBy===authData.username){
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
    }else{
        Post.findOneAndUpdate({postId:postId},{ $pull: { likes : PostFound.postedBy}},function(err){
            if(!err)
            {
                res.send("disliked");
            }
            else{
                res.send(err);
            }
        })
    }
}
else{
    res.send("please login first to like the photo");
}
}else{
    res.send("post not found");
}
   
    })
}
    })
});
  
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.route("/:postId/comment")
.put(verifyToken,function(req,res){
    jwt.verify(req.token, process.env.JWT_KEY, (err,authData) => {
        if(err) {
          res.sendStatus(403);
        } else {
  
     Post.findOne({postId:req.params.postId},function(err,PostFound){
        if(PostFound){
            if(PostFound.postedBy===authData.username){
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
            }else{
                res.send("please login first to comment on the post");
            }
        
        }else {
            res.send("sorry ! no post is been found with this id ")
        }
    });
}
});
});

function verifyToken(req, res, next) {
   
    const bearerHeader = req.headers['authorization'];
    if(typeof bearerHeader !== 'undefined') {
      const bearer = bearerHeader.split(' ');
      const bearerToken = bearer[1];
      req.token = bearerToken;
      next();
    } else {
      res.sendStatus(403);
    }
  
  }
  



app.listen(3000,function(){
    console.log("server started at port 3000");
});

