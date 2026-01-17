// console.log("APP START");

// require("dotenv").config();

// const connectDB = require("./db");
// connectDB(); // 🔥 IMPORTANT

// require("./cron");

// const express = require("express");
// const app = express();

// app.listen(3000, () => {
//   console.log("SERVER LISTENING ON PORT 3000");
// });

console.log("APP START");

require("dotenv").config();
console.log("CLIENT ID:", process.env.SLACK_CLIENT_ID);

const express = require("express");
const app = express();

// 👇 MUST be at the top
app.use(express.json());

const axios = require("axios");
const Workspace = require("./models/Workspace");
const BirthdayLog = require("./models/BirthdayLog");
const UserBirthday = require("./models/UserBirthday");
const { getSlackClient } = require("./slack");
const { sendMessage } = require("./slack");
const connectDB = require("./db");
connectDB();

// 🔥 Slack Events endpoint (VERIFICATION + EVENTS)
app.post("/slack/events", async (req, res) => {
     res.sendStatus(200);
    console.log("EVENT RECEIVED:", req.body.event);
  if (req.body.type === "url_verification") {
    // return res.status(200).send(req.body.challenge);
    return;
  }

  const event = req.body.event;
  console.log("EVENT RECEIVED:", event);
  if (!event) return res.sendStatus(200);

  if (
    event.type === "message" &&
    event.channel_type === "im" &&
    !event.bot_id
  ) {
    const text = (event.text || "").trim().toLowerCase();
    console.log("EVENT RECEIVED:", event);

// HELP COMMAND
if (text === "help") {
  const slackClient = await getSlackClient(event.team);

  await slackClient.chat.postMessage({
    channel: event.user,
    text: `ℹ️ *Birthday Bot Help*

• Send your birthday as: *YYYY-MM-DD*
  Example: *1999-03-21*

• I’ll remind your teammates on your birthday
• You will *not* receive the reminder yourself
• Messages are sent at *9 AM your local time*

Commands:
• *help* — show this message
• *delete my data* — remove your birthday`
  });

  return res.sendStatus(200);
}

// DELETE MY DATA COMMAND
if (text === "delete my data") {
  const slackClient = await getSlackClient(event.team);

  await UserBirthday.deleteOne({
    slackUserId: event.user
  });

  await BirthdayLog.deleteMany({
    slackUserId: event.user
  });

  await slackClient.chat.postMessage({
    channel: event.user,
    text: `🗑️ Your data has been deleted successfully.

• Your birthday is removed
• No future reminders will be sent

You can re-add your birthday anytime by sending it again 🎂`
  });

  return res.sendStatus(200);
}


    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const slackClient = await getSlackClient(event.team);

      const userInfo = await slackClient.users.info({
        user: event.user
      });

      await UserBirthday.findOneAndUpdate(
        { slackUserId: event.user },
        {
          birthday: text,
          timezone: userInfo.user.tz
        },
        { upsert: true }
      );
    }
    else {
  const slackClient = await getSlackClient(event.team);

  await slackClient.chat.postMessage({
    channel: event.user,
    text: `❌ That doesn’t look like a valid date.

Please send your birthday in this format:
👉 *YYYY-MM-DD*
Example: *1999-03-21*

Type *help* if you’re stuck 🙂`
  });
}

  }

  return res.sendStatus(200);
});


app.get("/slack/oauth_redirect", async (req, res) => {
  const code = req.query.code;

  try {
    const result = await axios.get(
      "https://slack.com/api/oauth.v2.access",
      {
        params: {
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: process.env.SLACK_REDIRECT_URI
        }
      }
    );

    console.log("OAuth response:", result.data);

    if (!result.data.ok) {
      return res.status(400).send("OAuth failed");
    }

    // ✅ SAFE teamId extraction (ALL CASES)
    const teamId =
  result.data.team?.id ||
  result.data.team_id ||
  result.data.authed_team?.id ||
  result.data.enterprise?.id;

if (!teamId) {
  console.error("No teamId found in OAuth response");
  return res.status(400).send("No teamId found");
}


    const botToken = result.data.access_token;

    await Workspace.findOneAndUpdate(
      { teamId },
      { botToken, enabled: true },
      { upsert: true }
    );

    // Send onboarding DM to installer
const installerId = result.data.authed_user?.id;

if (installerId) {
  const slackClient = new (require("@slack/web-api").WebClient)(botToken);

  await slackClient.chat.postMessage({
    channel: installerId,
    text: `👋 Hi! Thanks for installing *Birthday Bot* 🎉

Here’s how it works:
• Each teammate sends me their birthday in *YYYY-MM-DD* format
• On their birthday, I remind *everyone else* — not them 😉
• Wishes go out at *9 AM local time*

Try it now:
👉 Send me your birthday like: *1999-03-21*

Need help? Just type *help*.`
  });
}

res.send("🎉 Birthday Bot installed successfully!");
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send("OAuth error");
  }
});




app.post("/admin/workspace/toggle", express.json(), async (req, res) => {
  const { teamId, enabled } = req.body;

  await Workspace.findOneAndUpdate(
    { teamId },
    { enabled }
  );

  res.send({ success: true });
});



// ---- keep your existing imports below ----
// const connectDB = require("./db");
// connectDB();

require("./cron");

app.listen(3000, () => {
  console.log("SERVER LISTENING ON PORT 3000");
});
