import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_ORIGINS } from "@/lib/submit-response";

export const Route = createFileRoute("/_authenticated/formularios/$id_/respostas")({
  head: () => ({
    meta: [
      { title: "Respostas recebidas — FormulárioLab" },
      {
        name: "description",
        content: "Veja todas as inscrições recebidas e exporte os dados em PDF ou planilha Excel.",
      },
      { property: "og:title", content: "Respostas recebidas — FormulárioLab" },
      { property: "og:description", content: "Visualize e exporte as inscrições recebidas." },
    ],
  }),
  component: Respostas,
});

function Respostas() {
  const { id } = useParams({ from: "/_authenticated/formularios/$id_/respostas" });
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const query = useQuery({
    queryKey: ["respostas", id],
    queryFn: async () => {
      const [formRes, questionsRes, responsesRes] = await Promise.all([
        supabase.from("forms").select("title,max_responses,closes_at").eq("id", id).single(),
        supabase.from("questions").select("id,label").eq("form_id", id).order("position"),
        supabase
          .from("responses")
          .select("id,answers,submitted_at,edit_token")
          .eq("form_id", id)
          .order("submitted_at", { ascending: false }),
      ]);
      if (formRes.error) throw formRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (responsesRes.error) throw responsesRes.error;

      return {
        form: formRes.data as { title: string; max_responses: number | null; closes_at: string | null },
        questions: (questionsRes.data ?? []) as { id: string; label: string }[],
        responses: (responsesRes.data ?? []) as {
          id: string;
          answers: Record<string, string | string[]>;
          submitted_at: string;
          edit_token: string;
        }[],
      };
    },
  });

  const handleExportExcel = async (
    title: string,
    questions: { id: string; label: string }[],
    responses: { answers: Record<string, string | string[]>; submitted_at: string }[],
  ) => {
    try {
      setExporting("excel");
      const { exportToExcel } = await import("@/lib/exports");
      await exportToExcel(title, questions, responses);
    } catch {
      toast.error("Não foi possível exportar. Tente novamente.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async (
    title: string,
    questions: { id: string; label: string }[],
    responses: { answers: Record<string, string | string[]>; submitted_at: string }[],
  ) => {
    try {
      setExporting("pdf");
      const { exportToPDF } = await import("@/lib/exports");
      await exportToPDF(title, questions, responses);
    } catch {
      toast.error("Não foi possível exportar. Tente novamente.");
    } finally {
      setExporting(null);
    }
  };

  const handleCopyEditLink = async (token: string) => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      const link = `${ALLOWED_ORIGINS[0]}/editar/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link de edição copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  if (query.isError) {
    return (
      <section className="rise space-y-4">
        <div>
          <Link
            to="/formularios/$id"
            params={{ id }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Editor
          </Link>
        </div>
        <div className="glass rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-destructive font-medium">
            Não foi possível carregar as respostas.
          </p>
          <button
            onClick={() => query.refetch()}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90"
          >
            Tentar de novo
          </button>
        </div>
      </section>
    );
  }

  if (query.isLoading || !query.data) {
    return <p className="text-sm text-muted-foreground">Carregando respostas...</p>;
  }

  const { form, questions, responses } = query.data;
  const cell = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value.join(", ") : (value ?? "—");

  return (
    <section className="rise space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/formularios/$id"
            params={{ id }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Editor
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{form.title}</h1>
          <p className="text-sm text-muted-foreground">
            {responses.length} resposta(s)
            {form.max_responses ? ` de ${form.max_responses} vagas` : ""}
            {form.closes_at
              ? ` · prazo ${new Date(form.closes_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExportExcel(form.title, questions, responses)}
            disabled={responses.length === 0 || exporting !== null}
            className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-50"
          >
            Exportar Excel
          </button>
          <button
            onClick={() => handleExportPDF(form.title, questions, responses)}
            disabled={responses.length === 0 || exporting !== null}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 disabled:opacity-50"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        {responses.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nenhuma resposta ainda. Compartilhe o link do formulário para começar a receber
            inscrições.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-white/70 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Enviado em</th>
                  {questions.map((q) => (
                    <th key={q.id} className="px-4 py-3 font-medium">
                      {q.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id} className="border-t border-black/5 odd:bg-white/40">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(r.submitted_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    {questions.map((q) => (
                      <td key={q.id} className="px-4 py-3">
                        {cell(r.answers?.[q.id])}
                      </td>
                    ))}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleCopyEditLink(r.edit_token)}
                        className="rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium ring-1 ring-black/5 hover:bg-white"
                      >
                        Copiar link de edição
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
