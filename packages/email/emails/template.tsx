import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

const tailwindConfig = {
  theme: {
    extend: {
      colors: {
        background: "#f5f5f7",
        foreground: "#1a1a2e",
        card: "#ffffff",
        "card-foreground": "#1a1a2e",
        primary: "#d20033",
        "primary-foreground": "#ffffff",
        secondary: "#e8e8ed",
        "secondary-foreground": "#1a1a2e",
        muted: "#e0e0e6",
        surface: "#ebebf0",
        "muted-foreground": "#6b6b7b",
        accent: "#e8e8ed",
        "accent-foreground": "#1a1a2e",
        destructive: "#e04040",
        "destructive-foreground": "#ffffff",
        border: "#d8d8de",
        input: "#f5f5f7",
        ring: "#d20033",
        placeholder: "#9090a0",
        "theme-red": "#e85a2e",
        "theme-orange": "#d98028",
        "theme-yellow": "#d9a518",
        "theme-green": "#45b860",
        "theme-teal": "#38ad88",
        "theme-blue": "#1890f0",
        "theme-violet": "#7870c0",
        "theme-purple": "#a86090",
        "theme-pink": "#e06070",
      },
    },
  },
};

interface EmailTemplateProps {
  preview: string;
  children: ReactNode;
}

export function EmailTemplate({ preview, children }: EmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind config={tailwindConfig}>
        <Body className="bg-background font-sans">
          <Container className="mx-auto max-w-xl py-8">
            <Section className="rounded-lg bg-card px-8 py-6 shadow-sm">{children}</Section>
            <Text className="mt-6 text-center text-xs text-muted-foreground">
              Sent by{" "}
              <Link href="https://blackwall.dev" className="text-foreground underline">
                Blackwall
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
