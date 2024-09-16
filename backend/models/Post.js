const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    postContent: String,
    postMedia: String,
    like: {
      type: Array,
      default: [],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    userDetails: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
