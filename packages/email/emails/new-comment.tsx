import {
  Button,
  Column,
  Heading,
  Hr,
  Img,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { EmailTemplate } from "./template";

interface NewCommentEmailProps {
  issueKey: string;
  issueSummary: string;
  commenterName: string;
  commenterImage?: string | null;
  commentText: string;
  issueUrl: string;
}

export function NewCommentEmail({
  issueKey,
  issueSummary,
  commenterName,
  commenterImage,
  commentText,
  issueUrl,
}: NewCommentEmailProps) {
  const initials = commenterName.charAt(0).toUpperCase();

  return (
    <EmailTemplate preview={`${commenterName} commented on ${issueKey}`}>
      <Row className="mb-6">
        <Column className="w-12">
          {commenterImage ? (
            <Img
              src={commenterImage}
              alt={commenterName}
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <Img
              src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(commenterName)}&backgroundColor=e4dff0&textColor=2d2a3e`}
              alt={initials}
              width={40}
              height={40}
              className="rounded-full"
            />
          )}
        </Column>
        <Column>
          <Text className="m-0 font-medium text-foreground">{commenterName}</Text>
          <Text className="m-0 text-sm text-muted-foreground">left a comment</Text>
        </Column>
      </Row>

      <Section className="mb-6 rounded-lg border border-border bg-surface px-4 py-3">
        <Link href={issueUrl} className="text-sm font-medium text-muted-foreground no-underline">
          {issueKey}
        </Link>
        <Heading as="h2" className="m-0 mt-1 text-base font-semibold text-foreground">
          {issueSummary}
        </Heading>
      </Section>

      <Hr className="my-5 border-border" />

      <Section className="mb-6">
        <Text className="whitespace-pre-wrap leading-relaxed text-foreground">{commentText}</Text>
      </Section>

      <Section className="text-center">
        <Button
          href={issueUrl}
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground no-underline"
        >
          View Comment
        </Button>
      </Section>
    </EmailTemplate>
  );
}

export default NewCommentEmail;
