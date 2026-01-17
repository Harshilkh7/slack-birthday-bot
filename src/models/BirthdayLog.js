const mongoose = require("mongoose");

const birthdayLogSchema = new mongoose.Schema({
  slackUserId: { type: String, required: true },
  year: { type: Number, required: true },
  wishedAt: { type: Date, default: Date.now }
});

// Ensure one entry per user per year
birthdayLogSchema.index(
  { slackUserId: 1, year: 1 },
  { unique: true }
);

module.exports = mongoose.model("BirthdayLog", birthdayLogSchema);
