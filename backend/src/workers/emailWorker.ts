
import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { redis } from "../config/redis";
import { pool } from "../config/db";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const emailWorker = new Worker(
  "email-scheduler",
  async (job) => {
    const { emailId, recipient, subject, body } = job.data;

    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipient,
        subject: subject,
        text: body,
      });
      console.log("Ethereal Preview:", nodemailer.getTestMessageUrl(info));

      await pool.query(
        "UPDATE emails SET status = $1 WHERE id = $2",
        ["sent", emailId]
      );

      await pool.query(
        "UPDATE recipients SET status = $1 WHERE email_id = $2",
        ["sent", emailId]
      );

      await pool.query(
        `INSERT INTO email_logs
         (email_id, recipient_email, status)
         VALUES ($1, $2, $3)`,
        [emailId, recipient, "sent"]
      );

      console.log("Email sent successfully:", info.messageId);

      return { success: true };
    } catch (error: any) {
      await pool.query(
        "UPDATE emails SET status = $1 WHERE id = $2",
        ["failed", emailId]
      );

      await pool.query(
        "UPDATE recipients SET status = $1 WHERE email_id = $2",
        ["failed", emailId]
      );
      await pool.query(
        `INSERT INTO email_logs
        (email_id, recipient_email, status, error_message)
        VALUES ($1, $2, $3, $4)`,
        [emailId, recipient, "failed", error.message]
      );

      throw error;
    }
  },
  {
  connection: redis,
  concurrency: Number(process.env.WORKER_CONCURRENCY) || 5,
  limiter: {
    max: 1,
    duration: Math.max(
      Number(process.env.EMAIL_SEND_INTERVAL_MS) || 2000,
      Math.ceil(
        3600000 /
        (Number(process.env.MAX_EMAILS_PER_HOUR) || 200)
      )
    ),
  },
}
);

emailWorker.on("completed", (job) => {
  console.log(`Email job ${job.id} completed successfully`);
});

emailWorker.on("failed", (job, error) => {
  console.error(`Email job ${job?.id} failed:`, error.message);
});

console.log("Email sending worker started");
