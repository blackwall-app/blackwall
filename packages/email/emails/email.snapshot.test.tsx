import { describe, expect, it } from "bun:test";
import { renderToReadableStream } from "react-dom/server";
import type { ReactElement } from "react";
import { InviteEmail } from "./invite";
import { NewCommentEmail } from "./new-comment";
import { EmailTemplate } from "./template";

function extractHrefs(html: string) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

function extractFirstImageSrc(html: string) {
  return html.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null;
}

async function renderEmail(element: ReactElement) {
  const stream = await renderToReadableStream(element);
  return await new Response(stream).text();
}

describe("email rendering snapshots", () => {
  it("renders the base email template", async () => {
    const html = await renderEmail(
      <EmailTemplate preview="Template preview">
        <p>Body copy</p>
      </EmailTemplate>,
    );

    expect({
      hasPreview: html.includes("Template preview"),
      hasBodyCopy: html.includes("Body copy"),
      hrefs: extractHrefs(html),
    }).toMatchInlineSnapshot(`
      {
        "hasBodyCopy": true,
        "hasPreview": true,
        "hrefs": [
          "https://blackwall.dev",
        ],
      }
    `);
  });

  it("renders the invite email preview text and CTA target", async () => {
    const html = await renderEmail(
      <InviteEmail
        workspaceName="Acme"
        inviterName="Alice"
        invitationUrl="https://blackwall.dev/invite/token-123"
      />,
    );

    expect({
      hasPreview: html.includes("Alice invited you to Acme"),
      hasHeading: html.includes("invited to Blackwall"),
      hrefs: extractHrefs(html),
    }).toMatchInlineSnapshot(`
      {
        "hasHeading": true,
        "hasPreview": true,
        "hrefs": [
          "https://blackwall.dev/invite/token-123",
          "https://blackwall.dev",
        ],
      }
    `);
  });

  it("renders the new comment email with an avatar fallback and issue links", async () => {
    const html = await renderEmail(
      <NewCommentEmail
        issueKey="TES-1"
        issueSummary="Tighten coverage"
        commenterName="Alice Example"
        commentText="Looks good to me."
        issueUrl="https://blackwall.dev/issues/TES-1"
      />,
    );

    expect({
      hasPreview: html.includes("Alice Example commented on TES-1"),
      hasComment: html.includes("Looks good to me."),
      hrefs: extractHrefs(html),
      firstImageSrc: extractFirstImageSrc(html),
    }).toMatchInlineSnapshot(`
      {
        "firstImageSrc": "https://api.dicebear.com/9.x/initials/svg?seed=Alice%20Example&amp;backgroundColor=e4dff0&amp;textColor=2d2a3e",
        "hasComment": true,
        "hasPreview": true,
        "hrefs": [
          "https://api.dicebear.com/9.x/initials/svg?seed=Alice%20Example&amp;backgroundColor=e4dff0&amp;textColor=2d2a3e",
          "https://blackwall.dev/issues/TES-1",
          "https://blackwall.dev/issues/TES-1",
          "https://blackwall.dev",
        ],
      }
    `);
  });
});
