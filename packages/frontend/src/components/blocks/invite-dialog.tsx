import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { useDialogContext } from "@kobalte/core/dialog";
import * as z from "zod";
import { useAppForm } from "../../context/form-context";
import { Button } from "../ui/button";
import { TanStackTextField } from "../ui/text-field";
import { toast } from "../custom-ui/toast";

export function InviteDialogContent() {
  const ctx = useDialogContext();
  const form = useAppForm(() => ({
    defaultValues: {
      email: "",
    },
    validators: {
      onSubmit: z.object({
        email: z.email().min(1, m.invite_dialog_email_required()),
      }),
    },
    onSubmit: async ({ value }) => {
      await api.api.invitations.$post({
        json: { email: value.email },
      });

      toast.success(m.invite_toast_success());

      ctx.close();
    },
  }));

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{m.invite_dialog_title()}</DialogTitle>
        <DialogDescription>{m.invite_dialog_description()}</DialogDescription>
      </DialogHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.AppField name="email">
          {() => (
            <TanStackTextField
              id="email"
              describedBy="email-description"
              label={m.auth_email_address_label()}
              placeholder={m.auth_email_placeholder_signup()}
            />
          )}
        </form.AppField>

        <DialogFooter class="mt-6">
          <Button
            type="button"
            variant="ghost"
            data-testid="invite-dialog-cancel"
            onClick={() => {
              form.reset();
              ctx.close();
            }}
          >
            {m.common_cancel()}
          </Button>
          <form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                disabled={!state().canSubmit}
                data-testid="invite-dialog-submit"
              >
                {m.common_invite()}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
