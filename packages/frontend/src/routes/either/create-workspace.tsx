import { AuthCard } from "@/components/blocks/auth";
import { Button } from "@/components/ui/button";
import { TanStackTextField } from "@/components/ui/text-field";
import { useAppForm } from "@/context/form-context";
import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { useNavigate } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import type { CreateWorkspace } from "@blackwall/backend/src/features/workspaces/workspace.zod";
import { slugify } from "@/lib/utils";

export default function CreateWorkspacePage() {
  const navigate = useNavigate();

  let urlSpan!: HTMLSpanElement;

  const form = useAppForm(() => ({
    defaultValues: {
      displayName: "",
      slug: "",
    } satisfies CreateWorkspace,
    onSubmit: async ({ value }) => {
      const res = await api.api.workspaces.create.$post({
        json: value,
      });

      const { workspace } = await res.json();
      navigate(`/${workspace.slug}`);
    },
    listeners: {
      onChange: ({ fieldApi, formApi }) => {
        if (fieldApi.name !== "displayName") {
          return;
        }

        const slug = slugify(fieldApi.state.value);

        formApi.setFieldValue("slug", slug);
      },
    },
  }));

  return (
    <>
      <Title>{m.meta_title_create_workspace()}</Title>
      <Meta name="description" content={m.meta_desc_create_workspace()} />

      <AuthCard title={m.either_create_workspace_title()}>
        <form
          class="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.AppField name="displayName">
            {() => <TanStackTextField label={m.either_create_workspace_name_label()} />}
          </form.AppField>

          <form.AppField name="slug">
            {() => (
              <TanStackTextField
                label={m.either_create_workspace_url_label()}
                inputStyle={{
                  "padding-left": `${urlSpan.offsetWidth + 11}px`,
                }}
                beforeInput={
                  <span
                    ref={urlSpan}
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  >
                    {window.location.origin}/
                  </span>
                }
              />
            )}
          </form.AppField>

          <Button type="submit" class="w-full">
            {m.either_create_workspace_submit()}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
