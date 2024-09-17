const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

dotenv.config();

const db = require("../backend/config/db");
const User = require("./models/User");
const Post = require("./models/Post");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const cors = require("cors");
const isAuthenticated = require("../backend/config/auth");

const upload = require("../backend/utils/multer");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const corsOptions = {
  origin: "*",
  credential: true,
};
app.use(cors(corsOptions));

app.get("/", (req, res) => {
  res.json({ message: "Backend Running successfully" });
});

async function createUser(newUser) {
  try {
    const users = new User(newUser);
    const savedUser = await users.save();
    return savedUser;
  } catch (err) {
    throw err;
  }
}

app.post("/users", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(401).json({
        message: "All fields are required.",
        success: false,
      });
    }
    const user = await User.findOne({ email });
    if (user) {
      return res.status(401).json({
        message: "User already exist.",
        success: false,
      });
    }
    const hashedPassword = await bcryptjs.hash(password, 16);

    const newUser = await createUser({
      name,
      username,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      res.status(201).json({
        message: "Account created successfully.",
        success: true,
      });
    }
  } catch (error) {
    console.log(error);
  }
});

async function userLogin(user, password) {
  try {
    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return null;
    }
    const tokenData = {
      userId: user._id,
    };
    const token = await jwt.sign(tokenData, process.env.TOKEN_SECRET, {
      expiresIn: "30d",
    });

    return token;
  } catch (error) {
    throw error;
  }
}

app.post("/user/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(401).json({
        message: "All fields are required.",
        success: false,
      });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "Incorrect email or password",
        success: false,
      });
    } else {
      const token = await userLogin(user, password);

      if (token) {
        return res
          .status(201)
          .cookie("token", token, { expiresIn: "30d", httpOnly: true })
          .json({
            message: `Welcome back ${user.name}`,
            user: `${user._id}`,
            success: true,
          });
      } else {
        return res.status(401).json({
          message: "Incorrect email or password",
          success: false,
        });
      }
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/user/logout", (req, res) => {
  return res.cookie("token", "", { expiresIn: new Date(Date.now()) }).json({
    message: "User logged out successfully.",
    success: true,
  });
});

app.post("/post", upload.single("image"), async (req, res) => {
  try {
    const { postContent, id } = req.body;

    if (!postContent || !id) {
      return res.status(401).json({
        message: "Fields are required.",
        success: false,
      });
    }

    const user = await User.findById(id).select("-password");

    let mediaUrl;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      mediaUrl = result.secure_url;
    }

    const newPost = await Post.create({
      postContent,
      userId: id,
      userDetails: user,
      postMedia: mediaUrl,
    });

    res.status(201).json({
      message: "Post created successfully.",
      success: true,
      post: newPost,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function deletePost(postId) {
  try {
    const deletedPost = await Post.findByIdAndDelete(postId);
    return deletedPost;
  } catch (error) {
    throw error;
  }
}

app.delete("/post/:postId", async (req, res) => {
  try {
    const postDeleted = await deletePost(req.params.postId);

    if (deletePost) {
      res
        .status(200)
        .json({ message: "Post deleted Successfully", post: postDeleted });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function likeDislike(userId, postId, likeValue) {
  try {
    if (likeValue == "dislike") {
      const dislikedPost = await Post.findByIdAndUpdate(postId, {
        $pull: { like: userId },
      });
      return dislikedPost;
    } else {
      const likedPost = await Post.findByIdAndUpdate(postId, {
        $push: { like: userId },
      });
      return likedPost;
    }
  } catch (error) {
    throw error;
  }
}

app.put("/post/likeOrDislike/:postId", async (req, res) => {
  try {
    const loggedInUserId = req.body;
    const postId = req.params.postId;

    const post = await Post.findById(postId);

    const liked = post?.like?.some(
      (item) => item.loggedInUserId == loggedInUserId.loggedInUserId
    );

    if (liked) {
      const dislike = await likeDislike(loggedInUserId, postId, "dislike");
      if (dislike) {
        res.status(200).json({
          message: "User disliked your tweet",
        });
      }
    } else {
      const like = await likeDislike(loggedInUserId, postId, "like");
      if (like) {
        res.status(200).json({
          message: "User liked your tweet",
        });
      }
    }
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function bookmark(userId, postId, bookmarkValue) {
  try {
    if (bookmarkValue == "unsave") {
      const unsavedPost = await User.findByIdAndUpdate(userId, {
        $pull: { bookmarks: postId },
      });
      return unsavedPost;
    } else {
      const savedPost = await User.findByIdAndUpdate(userId, {
        $push: { bookmarks: postId },
      });

      return savedPost;
    }
  } catch (error) {
    throw error;
  }
}

app.put("/post/bookmark/:postId", async (req, res) => {
  try {
    const loggedInUserId = req.body.loggedInUserId;
    const postId = req.params.postId;

    const user = await User.findById(loggedInUserId);
    if (user?.bookmarks?.includes(postId)) {
      const unsave = await bookmark(loggedInUserId, postId, "unsave");
      if (unsave) {
        res.status(200).json({
          message: "User unsaved your tweet",
        });
      }
    } else {
      const save = await bookmark(loggedInUserId, postId, "save");
      if (save) {
        res.status(200).json({
          message: "User bookmarked your tweet",
        });
      }
    }
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function editPost(postId, updatedContent) {
  try {
    const post = await Post.findByIdAndUpdate(
      postId,
      { postContent: updatedContent },
      {
        new: true,
      }
    );

    return post;
  } catch (error) {
    throw error;
  }
}

app.put("/post/edit/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;
    const updatedContent = req.body.updatedContent;

    if (postId && updatedContent) {
      const updatedPost = await editPost(postId, updatedContent);

      if (updatedPost) {
        res
          .status(201)
          .json({ message: "Post Updated Successfully", post: updatedPost });
      }
    }
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/user/profile/image/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { profileImage } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { profileImage },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/user/profile/:id", async (req, res) => {
  try {
    const loggedInUserId = req.params.id;
    const user = await User.findById(loggedInUserId).select("-password");
    return res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/user/otherUsers/:id", async (req, res) => {
  try {
    const loggedInUserId = req.params.id;

    const user = await User.find({ _id: { $ne: loggedInUserId } }).select(
      "-password"
    );

    return res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

async function followUnfollowUser(loggedInUserId, userId) {
  try {
    const user = await User.findById(userId);
    const loggedInUser = await User.findById(loggedInUserId);

    if (user.followers.includes(loggedInUserId)) {
      // unfollow
      await user.updateOne({ $pull: { followers: loggedInUserId } });
      await loggedInUser.updateOne({ $pull: { following: userId } });
      return {
        success: true,
        message: `${loggedInUser.name} unfollowed ${user.name}`,
      };
    } else {
      //follow
      await user.updateOne({ $push: { followers: loggedInUserId } });
      await loggedInUser.updateOne({ $push: { following: userId } });
      return {
        success: true,
        message: `${loggedInUser.name} just followed ${user.name}`,
      };
    }
  } catch (error) {
    throw error;
  }
}

app.post("/user/follow/:userId", async (req, res) => {
  try {
    const loggedInUserId = req.body.loggedInUserId;
    const userId = req.params.userId;

    const result = await followUnfollowUser(loggedInUserId, userId);

    if (result) {
      res.status(200).json(result);
    }
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/feed/posts/:userId", async (req, res) => {
  try {
    const id = req.params.userId;

    const loggedInUser = await User.findById(id);

    const userPosts = await Post.find({ userId: id });
    const followingUserPosts = await Promise.all(
      loggedInUser.following.map((followersId) => {
        return Post.find({ userId: followersId });
      })
    );
    return res.status(200).json({
      posts: userPosts.concat(...followingUserPosts),
    });
  } catch (error) {
    throw error;
  }
});

app.get("/explore/posts/:userId", async (req, res) => {
  try {
    const id = req.params.userId;

    const explorePosts = await Post.find({
      userId: { $ne: id },
    });

    return res.json(explorePosts);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

async function getAllPosts() {
  try {
    const postList = await Post.find();

    return postList;
  } catch (error) {
    throw error;
  }
}

app.get("/allPosts", async (req, res) => {
  try {
    const posts = await getAllPosts();
    res.json(posts);
  } catch (error) {
    throw error;
  }
});

app.get("/user/userDetails/:userId", async (req, res) => {
  try {
    const userInfo = await User.findById(req.params.userId);
    res.json(userInfo);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("App is running on Port", PORT);
});
