let cachedUsers = null;
let lastFetchedAt = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

const { slack, sendMessage } = require("./slack");
const BirthdayLog = require("./models/BirthdayLog");
const UserBirthday = require("./models/UserBirthday");
const { DateTime } = require("luxon");

/**
 * Extract birthday from Slack profile fields
 */
// 👇 REPLACE with your real field ID
function extractBirthday(user) {
  const fields = user.profile.fields;
  if (!fields) return null;

  // Find the field that looks like a date
  for (const key in fields) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fields[key].value)) {
      return fields[key].value;
    }
  }

  return null;
}



/**
 * Check if birthday is today
 */
function isBirthdayNow(birthday, timezone) {
  if (!birthday || !timezone) return false;

  const now = DateTime.now().setZone(timezone);

  const [, month, day] = birthday.split("-").map(Number);

  return (
    now.month === month &&
    now.day === day &&
    now.hour === 9 // 🎯 9 AM local time
  );
}


/**
 * Get all real users from Slack
 */
async function getAllUsers() {
  const res = await slack.users.list();
  return res.members.filter(
    u => !u.is_bot && !u.deleted
  );
}


/**
 * Main birthday job
 */
// async function runBirthdayCheck() {
//   console.log("BIRTHDAY CHECK RUNNING");

//   const users = await getAllUsers();

//   const birthdayUsers = users.filter(user =>
//     isBirthdayToday(extractBirthday(user))
//   );

//   for (const birthdayUser of birthdayUsers) {

//   const alreadyWished = await alreadyWishedThisYear(birthdayUser.id);
//   if (alreadyWished) {
//     console.log(
//       `Already wished ${birthdayUser.real_name} this year`
//     );
//     continue;
//   }

//   for (const user of users) {
//     if (user.id !== birthdayUser.id) {
//       await sendMessage(
//         user.id,
//         `🎉 Today is ${birthdayUser.real_name}'s birthday! Wish them 🎂`
//       );
//     }
//   }

//   // 🔐 Mark after successful sending
//   await markAsWished(birthdayUser.id);
// }

// }

// async function runBirthdayCheck() {
//   console.log("BIRTHDAY CHECK RUNNING");

//   const users = await getAllUsers();

//   const birthdayUsers = users.filter(user =>
//     isBirthdayToday(extractBirthday(user))
//   );
  
//   console.log(
//   "Birthday users found:",
//   birthdayUsers.map(u => `${u.real_name} (${extractBirthday(u)})`)
// );

//   for (const birthdayUser of birthdayUsers) {

//     const alreadyWished = await alreadyWishedThisYear(birthdayUser.id);
//     if (alreadyWished) {
//       console.log(
//         `Already wished ${birthdayUser.real_name} this year`
//       );
//       continue;
//     }

//     for (const user of users) {
//       if (user.id !== birthdayUser.id) {
//         await sendMessage(
//           user.id,
//           `🎉 Today is ${birthdayUser.real_name}'s birthday! Wish them 🎂`
//         );
//       }
//     }

//     await markAsWished(birthdayUser.id);
//   }
// }

async function runBirthdayCheck() {
  console.log("BIRTHDAY CHECK RUNNING");
  
const workspace = await Workspace.findOne({ teamId });

if (!workspace || !workspace.enabled) {
  console.log("Workspace disabled:", teamId);
  return;
}
  const users = await getAllUsers();

  // Fetch all birthdays stored via DM
  const birthdays = await UserBirthday.find({});

  for (const entry of birthdays) {
    const birthdayUserId = entry.slackUserId;
    const birthday = entry.birthday;

    if (!isBirthdayNow(birthday, entry.timezone)) continue;

    const alreadyWished =
      await alreadyWishedThisYear(birthdayUserId);

    if (alreadyWished) {
      console.log(
        `Already wished ${birthdayUserId} this year`
      );
      continue;
    }

    const birthdayUser = users.find(
      u => u.id === birthdayUserId
    );

    if (!birthdayUser) continue;

    // Send DM to everyone except birthday person
    for (const user of users) {
      if (user.id !== birthdayUserId) {
        await sendMessage(
          user.id,
          `🎉 Today is ${birthdayUser.real_name}'s birthday! Wish them 🎂`
        );
      }
    }

    // Log to prevent duplicates
    await markAsWished(birthdayUserId);

    console.log(
      `Birthday wishes sent for ${birthdayUser.real_name}`
    );
  }
}



async function alreadyWishedThisYear(userId) {
  const year = new Date().getFullYear();

  const record = await BirthdayLog.findOne({
    slackUserId: userId,
    year
  });

  return !!record;
}

async function markAsWished(userId) {
  const year = new Date().getFullYear();

  await BirthdayLog.create({
    slackUserId: userId,
    year
  });
}

module.exports = { runBirthdayCheck };
