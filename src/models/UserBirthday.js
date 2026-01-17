const mongoose = require("mongoose");

const userBirthdaySchema = new mongoose.Schema({
  slackUserId: {
    type: String,
    required: true,
    unique: true
  },
  birthday: {
    type: String, // YYYY-MM-DD
    required: true
  },
  timezone: {
    type: String, // e.g. "Asia/Kolkata"
    required: true
  }
});

module.exports = mongoose.model(
  "UserBirthday",
  userBirthdaySchema
);
