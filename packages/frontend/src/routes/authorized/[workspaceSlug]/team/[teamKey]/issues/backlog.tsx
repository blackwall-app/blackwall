import { Navigate, useParams } from "@solidjs/router";

export default function BacklogRedirect() {
  const params = useParams();
  return (
    <Navigate href={`/${params.workspaceSlug}/team/${params.teamKey}/issues/backlog/active`} />
  );
}
