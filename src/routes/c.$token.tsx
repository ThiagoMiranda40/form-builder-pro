import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSharedResponses } from "@/lib/share.functions";
import { ResponsesTable } from "@/components/ResponsesTable";
import { ResponseDetailDialog } from "@/components/ResponseDetailDialog";
import {
  sortRows,
  type SortMode,
  type TableQuestion,
  type TableRow,
} from "@/lib/responses-table";

function formatUpdatedAt(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const timeStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `Atualizado às ${timeStr}`;
}

function formatClosesAt(dateStr: string): string {
  const d = new Date(dateStr);
  const datePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `Prazo: ${datePart} às ${timePart}`;
}

export const Route = createFileRoute("/c/$token")({
  head: () => ({
    meta: [
      { title: "Inscrições recebidas | Corre Time" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: SharedResponsesPage,
});

function SharedResponsesPage() {
  const { token } = useParams({ from: "/c/$token" });
  const fetchSharedData = useServerFn(getSharedResponses);

  const query = useQuery({
    queryKey: ["shared-responses", token],
    queryFn: () => fetchSharedData({ data: { token } }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [detailRow, setDetailRow] = useState<TableRow | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Carregando inscrições...</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="glass-strong rise w-full max-w-lg rounded-2xl p-6 text-center space-y-4 sm:p-8">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Não foi possível carregar as inscrições
          </h1>
          <p className="text-sm text-muted-foreground">
            Verifique sua conexão e tente novamente.
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 cursor-pointer"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (!query.data || query.data.state === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="glass-strong rise w-full max-w-lg rounded-2xl p-6 text-center sm:p-8">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Link não encontrado
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Este link não é válido ou foi desativado. Peça um novo link a quem o compartilhou.
          </p>
        </div>
      </div>
    );
  }

  const { form, questions, responses } = query.data;

  const handleExportExcel = async (
    title: string,
    qList: TableQuestion[],
    rList: TableRow[],
  ) => {
    try {
      setExporting("excel");
      const { exportToExcel } = await import("@/lib/exports");
      const sortedAll = sortRows(rList, qList, sortMode);
      await exportToExcel(title, qList, sortedAll);
    } catch {
      toast.error("Não foi possível exportar. Tente novamente.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async (
    title: string,
    qList: TableQuestion[],
    rList: TableRow[],
  ) => {
    try {
      setExporting("pdf");
      const { exportToPDF } = await import("@/lib/exports");
      const sortedAll = sortRows(rList, qList, sortMode);
      await exportToPDF(title, qList, sortedAll);
    } catch {
      toast.error("Não foi possível exportar. Tente novamente.");
    } finally {
      setExporting(null);
    }
  };

  const updatedAtText = formatUpdatedAt(query.dataUpdatedAt);
  const remainingVagas =
    form.max_responses !== null
      ? Math.max(0, form.max_responses - (form.responses_count ?? responses.length))
      : null;

  return (
    <div className="min-h-screen text-foreground print:bg-white print:text-black">
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 1cm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden,
          button,
          input[type="search"],
          select {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
        }
      `}</style>

      <main className="mx-auto max-w-[1200px] w-full px-4 py-8 sm:px-8 space-y-6 overflow-x-hidden">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {form.title}
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-black/5">
                Somente leitura
              </span>
              {updatedAtText && (
                <span className="text-xs text-slate-600 print:hidden">{updatedAtText}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                {responses.length === 1 ? "1 inscrição" : `${responses.length} inscrições`}
              </span>
              {remainingVagas !== null && (
                <span>
                  · {remainingVagas} {remainingVagas === 1 ? "vaga restante" : "vagas restantes"}
                </span>
              )}
              {form.closes_at && <span>· {formatClosesAt(form.closes_at)}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => handleExportExcel(form.title, questions, responses)}
              disabled={responses.length === 0 || exporting !== null}
              className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {exporting === "excel" ? "Gerando…" : "Baixar Excel"}
            </button>
            <button
              type="button"
              onClick={() => handleExportPDF(form.title, questions, responses)}
              disabled={responses.length === 0 || exporting !== null}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {exporting === "pdf" ? "Gerando…" : "Baixar PDF"}
            </button>
          </div>
        </div>

        {/* Tabela de respostas reutilizada */}
        <ResponsesTable
          questions={questions}
          rows={responses}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          showUpdatedAt={false}
          emptyMessage="Nenhuma inscrição recebida até o momento."
          onRowClick={(row) => {
            const full = responses.find((r) => r.id === row.id) || row;
            setDetailRow(full);
          }}
        />

        {/* Diálogo de detalhes somente leitura (sem slot actions) */}
        <ResponseDetailDialog
          open={detailRow !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDetailRow(null);
            }
          }}
          row={detailRow}
          questions={questions}
        />
      </main>
    </div>
  );
}
