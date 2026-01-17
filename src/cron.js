import cron from "node-cron";
import { runBirthdayCheck } from "./birthday.js";

console.log("CRON FILE LOADED");

cron.schedule("0 * * * *", async () => {
  await runBirthdayCheck();
});