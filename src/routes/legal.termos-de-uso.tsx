import { createFileRoute } from "@tanstack/react-router";
import { termosDeUso } from "@/content/legal";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/termos-de-uso")({
  head: () => ({
    meta: [{ title: "Termos de Uso" }],
  }),
  component: TermosDeUsoRoute,
});

function TermosDeUsoRoute() {
  return (
    <LegalPage
      document={termosDeUso}
      otherLink={{
        to: "/legal/politica-de-privacidade",
        label: "Ver também: Política de Privacidade",
      }}
    />
  );
}
