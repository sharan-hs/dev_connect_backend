const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    profileImage: {
      type: String,
      default: "https://placehold.co/40",
    },
    username: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
      unique: true,
    },
    password: String,
    followers: {
      type: Array,
      default: [],
    },
    following: {
      type: Array,
      default: [],
    },
    bookmarks: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
