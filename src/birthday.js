import { DateTime } from "luxon";

import Workspace from "./models/Workspace.js";
import BirthdayLog from "./models/BirthdayLog.js";
import UserBirthday from "./models/UserBirthday.js";
import { getSlackClient } from "./slack.js";

/**
 * Check if birthday is now (9 AM local time)
 */
function isBirthdayNow(birthday, timezone) {
  if (!birthday || !timezone) return false;

  const now = DateTime.now().setZone(timezone);
  const [, month, day] = birthday.split("-").map(Number);

  return (
    now.month === month &&
    now.day === day &&
    now.hour === 9
  );
}

/**
 * Get all real Slack users
 */
async function getAllUsers(slackClient) {
  const res = await slackClient.users.list();
  return res.members.filter(
    u => !u.is_bot && !u.deleted
  );
}

/**
 * Check if already wished this year
 */
async function alreadyWishedThisYear(userId) {
  const year = new Date().getFullYear();

  const record = await BirthdayLog.findOne({
    slackUserId: userId,
    year
  });

  return !!record;
}

/**
 * Mark birthday as wished
 */
async function markAsWished(userId) {
  const year = new Date().getFullYear();

  await BirthdayLog.create({
    slackUserId: userId,
    year
  });
}

/**
 * Main birthday job
 */
export async function runBirthdayCheck() {
  console.log("🎂 BIRTHDAY CHECK RUNNING");

  const workspaces = await Workspace.find({ enabled: true });

  for (const workspace of workspaces) {
    const slackClient = await getSlackClient(workspace.teamId);
    const users = await getAllUsers(slackClient);

    const birthdays = await UserBirthday.find({});

    for (const entry of birthdays) {
      if (!isBirthdayNow(entry.birthday, entry.timezone)) continue;

      const alreadyWished = await alreadyWishedThisYear(
        entry.slackUserId
      );

      if (alreadyWished) continue;

      const birthdayUser = users.find(
        u => u.id === entry.slackUserId
      );

      if (!birthdayUser) continue;

      for (const user of users) {
        if (user.id !== entry.slackUserId) {
          await slackClient.chat.postMessage({
            channel: user.id,
            text: `🎉 Today is ${birthdayUser.real_name}'s birthday! Wish them 🎂`
          });
        }
      }

      await markAsWished(entry.slackUserId);

      console.log(
        `🎉 Wishes sent for ${birthdayUser.real_name}`
      );
    }
  }
}
