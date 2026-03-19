import { AuthShell } from "@/components/blocks/auth";
import type { JSX } from "solid-js";

export default function GuestLayout(props: { children?: JSX.Element }) {
  return <AuthShell>{props.children}</AuthShell>;
}
