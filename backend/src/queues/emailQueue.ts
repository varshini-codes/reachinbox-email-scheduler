
import { Queue } from "bullmq";
import { redis } from "../config/redis";

export const emailQueue = new Queue("email-scheduler", {
  connection: redis,
});

console.log("Email scheduling queue initialized");
