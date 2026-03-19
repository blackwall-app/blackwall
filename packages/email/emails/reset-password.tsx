import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailTemplate } from "./template";

interface ResetPasswordEmailProps {
  resetUrl: string;
}

export function ResetPasswordEmail({ resetUrl }: ResetPasswordEmailProps) {
  return (
    <EmailTemplate preview="Reset your Blackwall password">
      <Heading as="h1" className="m-0 mb-4 text-xl font-semibold text-foreground">
        Reset your password
      </Heading>

      <Text className="mb-6 leading-relaxed text-foreground">
        We received a request to reset your Blackwall password. Click the button below to set a new
        password. This link expires in 1 hour.
      </Text>

      <Section className="text-center">
        <Button
          href={resetUrl}
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground no-underline"
        >
          Reset Password
        </Button>
      </Section>

      <Text className="mt-6 text-sm text-muted-foreground">
        If you didn't request a password reset, you can safely ignore this email.
      </Text>
    </EmailTemplate>
  );
}

export default ResetPasswordEmail;
