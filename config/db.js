const mongoose = require("mongoose");

const mySecret = process.env["MONGO_DB"];

mongoose
  .connect(mySecret)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.log("Error connecting to DB", error);
  });
