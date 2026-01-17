export const birthdayModal = {
  type: "modal",
  callback_id: "birthday_modal",
  title: {
    type: "plain_text",
    text: "🎂 Your Birthday"
  },
  submit: {
    type: "plain_text",
    text: "Save"
  },
  close: {
    type: "plain_text",
    text: "Cancel"
  },
  blocks: [
    {
      type: "input",
      block_id: "birthday_block",
      label: {
        type: "plain_text",
        text: "Select your birthday"
      },
      element: {
        type: "datepicker",
        action_id: "birthday_date",
        placeholder: {
          type: "plain_text",
          text: "Pick a date"
        }
      }
    }
  ]
};
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