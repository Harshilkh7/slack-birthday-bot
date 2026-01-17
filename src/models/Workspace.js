const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema({
  teamId: { type: String, unique: true },
  botToken: { type: String, required: true },
  enabled: { type: Boolean, default: true }
});

module.exports = mongoose.model("Workspace", workspaceSchema);
