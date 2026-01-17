import { WebClient } from "@slack/web-api";
import Workspace from "./models/Workspace.js";

/**
 * Returns a Slack client for a workspace
 */
export async function getSlackClient(teamId) {
  const workspace = await Workspace.findOne({ teamId });

  if (!workspace) {
    throw new Error("Workspace not found for teamId: " + teamId);
  }

  return new WebClient(workspace.botToken);
}

/**
 * Birthday modal definition
 */
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
