const { WebClient } = require("@slack/web-api");
const Workspace = require("./models/Workspace");

async function getSlackClient(teamId) {
  const workspace = await Workspace.findOne({ teamId });
  if (!workspace) {
    throw new Error("Workspace not found");
  }
  return new WebClient(workspace.botToken);
}

module.exports = { getSlackClient };
