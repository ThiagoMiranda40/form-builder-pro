import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSharedResponses, unlockSharedLink } from "@/lib/share.functions";
import { ResponsesTable } from "@/components/ResponsesTable";
import { ResponseDetailDialog } from "@/components/ResponseDetailDialog";
import {
  sortRows,
  type SortMode,
  type TableQuestion,
  type TableRow,
} from "@/lib/responses-table";
import { buildClientLinkMeta } from "@/lib/site-meta";

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

const clientMeta = buildClientLinkMeta();

export const Route = createFileRoute("/c/$token")({
  head: () => ({
    meta: [
      { title: clientMeta.title },
      { name: "description", content: clientMeta.description },
      { property: "og:title", content: clientMeta.ogTitle },
      { property: "og:description", content: clientMeta.ogDescription },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: SharedResponsesPage,
});

function SharedResponsesPage() {
  const { token } = useParams({ from: "/c/$token" });
  const fetchSharedData = useServerFn(getSharedResponses);
  const unlockSharedLinkFn = useServerFn(unlockSharedLink);

  const query = useQuery({
    queryKey: ["shared-responses", token],
    queryFn: () => fetchSharedData({ data: { token } }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [detailRow, setDetailRow] = useState<TableRow | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [code, setCode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data?.state !== "ok" && detailRow !== null) {
      setDetailRow(null);
    }
  }, [query.data?.state, detailRow]);

  const handleUnlockSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await unlockSharedLinkFn({ data: { token, code } });
      if (res.state === "ok") {
        setCode("");
        setUnlockError(null);
        await query.refetch();
        return;
      }
      if (res.state === "not_found") {
        await query.refetch();
        return;
      }
      if (res.state === "wrong_code") {
        setUnlockError("Código incorreto. Confira e tente novamente.");
        return;
      }
      if (res.state === "locked_out") {
        setUnlockError("Muitas tentativas. Aguarde 15 minutos e tente de novo.");
        return;
      }
      setUnlockError("Não foi possível verificar o código agora. Tente novamente.");
    } catch {
      setUnlockError("Não foi possível verificar o código agora. Tente novamente.");
    } finally {
      setUnlocking(false);
    }
  };

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

  if (query.data.state === "locked") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="glass-strong rise w-full max-w-md rounded-2xl p-6 space-y-5 sm:p-8">
          <div className="space-y-2 text-center">
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Link protegido
            </h1>
            <p className="text-sm text-muted-foreground">
              Digite o código de acesso que o administrador enviou para ver as inscrições.
            </p>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="share-access-code"
                className="block text-xs font-medium text-foreground"
              >
                Código de acesso
              </label>
              <input
                id="share-access-code"
                type="text"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                aria-invalid={Boolean(unlockError)}
                aria-describedby={unlockError ? "share-access-code-error" : undefined}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (unlockError) setUnlockError(null);
                }}
                placeholder="Ex.: ABCDE23456"
                className="w-full rounded-lg bg-white/90 px-3 py-2.5 font-mono text-sm tracking-widest uppercase ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>

            {unlockError && (
              <p
                id="share-access-code-error"
                role="alert"
                className="text-xs font-medium text-destructive"
              >
                {unlockError}
              </p>
            )}

            <button
              type="submit"
              disabled={unlocking || code.trim().length === 0}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {unlocking ? "Verificando..." : "Acessar"}
            </button>
          </form>
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
