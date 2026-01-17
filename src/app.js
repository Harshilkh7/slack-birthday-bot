console.log("APP START");

import "dotenv/config";
import express from "express";
import axios from "axios";

import connectDB from "./db.js";
import "./cron.js";

import Workspace from "./models/Workspace.js";
import BirthdayLog from "./models/BirthdayLog.js";
import UserBirthday from "./models/UserBirthday.js";

import { getSlackClient, birthdayModal } from "./slack.js";

const app = express();
app.use(express.json());

connectDB();
console.log("CLIENT ID:", process.env.SLACK_CLIENT_ID);

// Keep outside handlers
const processedEvents = new Set();

// 🔥 Slack Events endpoint (VERIFICATION + EVENTS)
app.post("/slack/events", async (req, res) => {
    console.log("SLACK HIT /slack/events");
  // 🔑 Slack URL verification (MUST be first)
  if (req.body.type === "url_verification") {
    return res.status(200).json({
      challenge: req.body.challenge
    });
  }

  // ✅ ACK Slack immediately for all other events
  res.sendStatus(200);

   console.log("RAW SLACK BODY:", JSON.stringify(req.body, null, 2));

  const event = req.body.event;
  if (!event) return;

  console.log("EVENT RECEIVED:", event);

  // Only handle user DMs (ignore bot + non-DM messages)
if (
  event.type !== "message" ||
  event.channel_type !== "im" ||
  event.subtype ||    // 👈 ignore non-user messages safely
  event.bot_id
) {
  return;
}
  // ✅ Idempotency
  const eventId = event.client_msg_id || event.ts;
  if (processedEvents.has(eventId)) {
    console.log("Duplicate event ignored:", eventId);
    return;
  }
  processedEvents.add(eventId);

  const text = (event.text || "").trim().toLowerCase();
  const slackClient = await getSlackClient(event.team);

  /* =========================
     HELP COMMAND
  ========================= */
  if (text === "help") {
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
    return;
  }

  /* =========================
     DELETE MY DATA
  ========================= */
  if (text === "delete my data") {
    await UserBirthday.deleteOne({ slackUserId: event.user });
    await BirthdayLog.deleteMany({ slackUserId: event.user });

    await slackClient.chat.postMessage({
      channel: event.user,
      text: `🗑️ Your data has been deleted successfully.`
    });
    return;
  }

  if (text === "birthday") {
  await slackClient.views.open({
    trigger_id: req.body.trigger_id,
    view: birthdayModal
  });
  return;
}

  /* =========================
     BIRTHDAY INPUT
  ========================= */
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
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

    await slackClient.chat.postMessage({
      channel: event.user,
      text: "🎉 Thanks! Your birthday has been saved successfully."
    });

    return;
  }

  /* =========================
     INVALID INPUT
  ========================= */
  await slackClient.chat.postMessage({
    channel: event.user,
    text: `❌ Invalid date format. Use *YYYY-MM-DD*.`
  });
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
  const slackClient = new WebClient(botToken);

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

app.post(
  "/slack/interactions",
  express.urlencoded({ extended: true }),
  async (req, res) => {
    const payload = JSON.parse(req.body.payload);

    if (
      payload.type === "view_submission" &&
      payload.view.callback_id === "birthday_modal"
    ) {
      const birthday =
        payload.view.state.values.birthday_block.birthday_date.selected_date;

      const userId = payload.user.id;
      const teamId = payload.team.id;

      const slackClient = await getSlackClient(teamId);
      const userInfo = await slackClient.users.info({ user: userId });

      await UserBirthday.findOneAndUpdate(
        { slackUserId: userId },
        {
          birthday,
          timezone: userInfo.user.tz
        },
        { upsert: true }
      );

      await slackClient.chat.postMessage({
        channel: userId,
        text: "🎉 Your birthday has been saved successfully!"
      });

      return res.json({ response_action: "clear" });
    }

    res.sendStatus(200);
  }
);



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

app.listen(3000, () => {
  console.log("SERVER LISTENING ON PORT 3000");
});
