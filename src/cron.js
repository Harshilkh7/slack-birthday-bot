console.log("CRON FILE LOADED");

const cron = require("node-cron");
const { runBirthdayCheck } = require("./birthday");

cron.schedule("0 * * * *", async () => {
  console.log("CRON TRIGGERED");
  await runBirthdayCheck();
});
