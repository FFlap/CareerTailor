import { Navigate, createFileRoute } from "@tanstack/react-router";

/** The page was called the gallery until it was called Documents, like the nav. */
export const Route = createFileRoute("/gallery")({
  component: () => <Navigate to="/documents" replace />,
});
