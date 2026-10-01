import { createFileRoute } from "@tanstack/react-router";
import { politicaDePrivacidade } from "@/content/legal";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/politica-de-privacidade")({
  head: () => ({
    meta: [{ title: "Política de Privacidade" }],
  }),
  component: PoliticaDePrivacidadeRoute,
});

function PoliticaDePrivacidadeRoute() {
  return (
    <LegalPage
      document={politicaDePrivacidade}
      otherLink={{
        to: "/legal/termos-de-uso",
        label: "Ver também: Termos de Uso",
      }}
    />
  );
}
