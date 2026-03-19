import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailTemplate } from "./template";

interface InviteEmailProps {
  workspaceName: string;
  inviterName: string;
  invitationUrl: string;
}

export function InviteEmail({ workspaceName, inviterName, invitationUrl }: InviteEmailProps) {
  return (
    <EmailTemplate preview={`${inviterName} invited you to ${workspaceName}`}>
      <Heading as="h1" className="m-0 mb-4 text-xl font-semibold text-foreground">
        You've been invited to Blackwall
      </Heading>

      <Text className="mb-6 leading-relaxed text-foreground">
        {inviterName} has invited you to join <strong>{workspaceName}</strong> workspace on
        Blackwall. Click the button below to accept the invitation.
      </Text>

      <Section className="text-center">
        <Button
          href={invitationUrl}
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground no-underline"
        >
          Accept Invitation
        </Button>
      </Section>
    </EmailTemplate>
  );
}

export default InviteEmail;
