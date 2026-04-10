import { SES } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import { env } from "./zod-env";

export type SendableEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function createTransporter() {
  if (env.AWS_REGION) {
    const ses = new SES({
      region: env.AWS_REGION,
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
    return nodemailer.createTransport({ SES: { ses, aws: { SES } } });
  }

  if (env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return null;
}

const transporter = createTransporter();

export async function sendEmail(email: SendableEmail) {
  if (!transporter) {
    console.log("Attempted to send email without email configuration:");
    console.log(email);
    console.log("Add SMTP or AWS SES configuration to enable email sending.");
    return;
  }

  const info = await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  return info;
}
