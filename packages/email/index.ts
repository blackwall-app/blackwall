import { render } from "@react-email/components";
import type { ReactElement } from "react";

export { EmailTemplate } from "./emails/template";
export { InviteEmail } from "./emails/invite";
export { NewCommentEmail } from "./emails/new-comment";
export { ResetPasswordEmail } from "./emails/reset-password";

export type { ReactElement };

export async function renderEmail(component: ReactElement) {
  return render(component);
}
