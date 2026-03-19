import { Navigate, useParams } from "@solidjs/router";

export default function SettingsIndexPage() {
  const params = useParams();
  return <Navigate href={`/${params.workspaceSlug}/settings/general`} />;
}
