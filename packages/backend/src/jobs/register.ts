import { InviteEmail, NewCommentEmail, ResetPasswordEmail, renderEmail } from "@blackwall/email";
import { jobService } from "@blackwall/queue";
import { renderToHTMLString } from "@tiptap/static-renderer";
import StarterKit from "@tiptap/starter-kit";
import { sendEmail } from "../lib/emails";
import { commentData } from "../features/issues/comment.data";
import { userData } from "../features/users/user.data";
import { env } from "../lib/zod-env";

type InviteEmailPayload = {
  email: string;
  workspaceName: string;
  inviterName: string;
  invitationUrl: string;
};

jobService.registerHandler("invite-email", async (payload: InviteEmailPayload) => {
  const html = await renderEmail(
    InviteEmail({
      workspaceName: payload.workspaceName,
      inviterName: payload.inviterName,
      invitationUrl: payload.invitationUrl,
    }),
  );

  await sendEmail({
    to: payload.email,
    subject: "You've been invited to Blackwall",
    html,
    text: `${payload.inviterName} has invited you to join ${payload.workspaceName} on Blackwall.\n\nAccept the invitation: ${payload.invitationUrl}`,
  });
});

type ResetPasswordEmailPayload = {
  email: string;
  resetUrl: string;
};

jobService.registerHandler("reset-password-email", async (payload: ResetPasswordEmailPayload) => {
  const html = await renderEmail(
    ResetPasswordEmail({
      resetUrl: payload.resetUrl,
    }),
  );

  await sendEmail({
    to: payload.email,
    subject: "Reset your Blackwall password",
    html,
    text: `Reset your Blackwall password by visiting: ${payload.resetUrl}\n\nIf you didn't request a password reset, you can safely ignore this email.`,
  });
});

type CommentEmailPayload = {
  commentId: string;
  recipientIds: string[];
};

function tiptapToPlainText(content: unknown): string {
  if (!content) return "";
  const html = renderToHTMLString({ content, extensions: [StarterKit] });
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

jobService.registerHandler("comment-email", async (payload: CommentEmailPayload) => {
  const comment = await commentData.getCommentWithAuthorAndIssue(payload.commentId);

  if (!comment || !comment.issue || !comment.issue.workspace) return;

  if (payload.recipientIds.length === 0) return;

  const recipients = await userData.getUsersByIds(payload.recipientIds);
  if (recipients.length === 0) return;

  const issueUrl = `${env.APP_BASE_URL}/${comment.issue.workspace.slug}/issue/${comment.issue.key}`;
  const commentText = tiptapToPlainText(comment.content);

  const html = await renderEmail(
    NewCommentEmail({
      issueKey: comment.issue.key,
      issueSummary: comment.issue.summary,
      commenterName: comment.author.name,
      commenterImage: comment.author.image,
      commentText,
      issueUrl,
    }),
  );

  for (const recipient of recipients) {
    await sendEmail({
      to: recipient.email,
      subject: `${comment.author.name} commented on ${comment.issue.key}`,
      html,
      text: `${comment.author.name} commented on ${comment.issue.key}: ${comment.issue.summary}\n\n${commentText}\n\nView: ${issueUrl}`,
    });
  }
});
