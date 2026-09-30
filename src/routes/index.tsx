import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
  component: Index,
});

function Index() {
  return null;
}
