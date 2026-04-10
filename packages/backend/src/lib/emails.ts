import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import { env } from "./zod-env";

export type SendableEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

interface EmailTransport {
  send(email: SendableEmail): Promise<void>;
}

class SesTransport implements EmailTransport {
  private client: SESClient;

  constructor(client: SESClient) {
    this.client = client;
  }

  async send(email: SendableEmail) {
    await this.client.send(
      new SendEmailCommand({
        Source: env.EMAIL_FROM,
        Destination: { ToAddresses: [email.to] },
        Message: {
          Subject: { Data: email.subject },
          Body: {
            Html: { Data: email.html },
            Text: { Data: email.text },
          },
        },
      }),
    );
  }
}

class SmtpTransport implements EmailTransport {
  private transporter: nodemailer.Transporter;

  constructor(transporter: nodemailer.Transporter) {
    this.transporter = transporter;
  }

  async send(email: SendableEmail) {
    await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
}

class NullTransport implements EmailTransport {
  async send(email: SendableEmail) {
    console.log("Attempted to send email without email configuration:");
    console.log(email);
    console.log("Add SMTP or AWS SES configuration to enable email sending.");
  }
}

function createTransport(): EmailTransport {
  if (env.AWS_REGION) {
    const client = new SESClient({
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
    return new SesTransport(client);
  }

  if (env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
    return new SmtpTransport(transporter);
  }

  return new NullTransport();
}

const transport = createTransport();

export async function sendEmail(email: SendableEmail) {
  return transport.send(email);
}
