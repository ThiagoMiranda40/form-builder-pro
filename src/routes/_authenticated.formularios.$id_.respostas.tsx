import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_ORIGINS } from "@/lib/submit-response";
import { isEdited, describeResponse } from "@/lib/responses-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminEditResponseDialog } from "@/components/AdminEditResponseDialog";
import { ResponsesTable } from "@/components/ResponsesTable";
import { ResponseDetailDialog } from "@/components/ResponseDetailDialog";
import {
  sortRows,
  findNameQuestion,
  type SortMode,
  type TableRow,
} from "@/lib/responses-table";
import { findEmailQuestionWithAnswer } from "@/lib/admin-response";
import { resendEditLink } from "@/lib/admin-response.functions";

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
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [detailRow, setDetailRow] = useState<{
    id: string;
    answers: Record<string, string | string[]>;
    submitted_at: string;
    updated_at: string | null;
    edit_token: string;
    identifier?: string | null;
  } | null>(null);
  const [confirmResendRow, setConfirmResendRow] = useState<{
    id: string;
    answers: Record<string, string | string[]>;
  } | null>(null);
  const [isResending, setIsResending] = useState(false);

  const [responseToEdit, setResponseToEdit] = useState<{
    id: string;
    answers: Record<string, string | string[]>;
    identifier?: string | null;
  } | null>(null);
  const [responseToDelete, setResponseToDelete] = useState<{
    id: string;
    answers: Record<string, string | string[]>;
    submitted_at: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const query = useQuery({
    queryKey: ["respostas", id],
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const [formRes, questionsRes, responsesRes] = await Promise.all([
        supabase.from("forms").select("title,max_responses,closes_at").eq("id", id).single(),
        supabase
          .from("questions")
          .select("id,label,field_type,required,options,help_text")
          .eq("form_id", id)
          .order("position"),
        supabase
          .from("responses")
          .select("id,answers,submitted_at,updated_at,edit_token,identifier")
          .eq("form_id", id)
          .order("submitted_at", { ascending: false }),
      ]);
      if (formRes.error) throw formRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (responsesRes.error) throw responsesRes.error;

      return {
        form: formRes.data as { title: string; max_responses: number | null; closes_at: string | null },
        questions: (questionsRes.data ?? []) as {
          id: string;
          label: string;
          field_type?: string;
          required?: boolean;
          options?: string[];
          help_text?: string | null;
        }[],
        responses: (responsesRes.data ?? []) as {
          id: string;
          answers: Record<string, string | string[]>;
          submitted_at: string;
          updated_at: string | null;
          edit_token: string;
          identifier?: string | null;
        }[],
      };
    },
  });

  const handleExportExcel = async (
    title: string,
    questions: { id: string; label: string; field_type?: string }[],
    responses: { id: string; answers: Record<string, string | string[]>; submitted_at: string }[],
  ) => {
    try {
      setExporting("excel");
      const { exportToExcel } = await import("@/lib/exports");
      const sortedAll = sortRows(responses, questions, sortMode);
      await exportToExcel(title, questions, sortedAll);
    } catch {
      toast.error("Não foi possível exportar. Tente novamente.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async (
    title: string,
    questions: { id: string; label: string; field_type?: string }[],
    responses: { id: string; answers: Record<string, string | string[]>; submitted_at: string }[],
  ) => {
    try {
      setExporting("pdf");
      const { exportToPDF } = await import("@/lib/exports");
      const sortedAll = sortRows(responses, questions, sortMode);
      await exportToPDF(title, questions, sortedAll);
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

  const handleDeleteResponse = async () => {
    if (!responseToDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      const { data, error } = await supabase
        .from("responses")
        .delete()
        .eq("id", responseToDelete.id)
        .eq("form_id", id)
        .select("id");

      if (error || !data || data.length !== 1) {
        toast.error("Não foi possível excluir. Tente novamente.");
        return;
      }

      toast.success("Inscrição excluída.");
      if (detailRow && detailRow.id === responseToDelete.id) {
        setDetailRow(null);
      }
      setResponseToDelete(null);
      await query.refetch();
    } catch {
      toast.error("Não foi possível excluir. Tente novamente.");
    } finally {
      setIsDeleting(false);
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
  const editedCount = responses.filter((r) => isEdited(r.submitted_at, r.updated_at)).length;
  const displayedResponses = onlyEdited
    ? responses.filter((r) => isEdited(r.submitted_at, r.updated_at))
    : responses;

  const updatedAtText = formatUpdatedAt(query.dataUpdatedAt);

  const detailEmailInfo = detailRow
    ? findEmailQuestionWithAnswer(questions, detailRow.answers)
    : null;
  const detailRecipientEmail = detailEmailInfo?.email || "";
  const detailHasEmail = Boolean(detailRecipientEmail);

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
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{form.title}</h1>
            {updatedAtText && (
              <span className="text-xs text-slate-600">{updatedAtText}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {responses.length} resposta(s)
            {form.max_responses ? ` de ${form.max_responses} vagas` : ""}
            {editedCount > 0 ? ` · ${editedCount} editada(s)` : ""}
            {form.closes_at
              ? ` · prazo ${new Date(form.closes_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white cursor-pointer"
          >
            Atualizar
          </button>
          {editedCount > 0 && (
            <button
              type="button"
              aria-pressed={onlyEdited}
              onClick={() => setOnlyEdited((prev) => !prev)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/5 transition-colors cursor-pointer ${
                onlyEdited
                  ? "bg-amber-100 text-amber-900 ring-amber-300 hover:bg-amber-200"
                  : "bg-white/70 text-foreground hover:bg-white"
              }`}
            >
              {onlyEdited ? "Mostrar todas" : "Mostrar só editadas"}
            </button>
          )}
          <button
            onClick={() => handleExportExcel(form.title, questions, responses)}
            disabled={responses.length === 0 || exporting !== null}
            className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            Exportar Excel
          </button>
          <button
            onClick={() => handleExportPDF(form.title, questions, responses)}
            disabled={responses.length === 0 || exporting !== null}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      <ResponsesTable
        questions={questions}
        rows={displayedResponses}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        showUpdatedAt={true}
        emptyMessage={
          onlyEdited
            ? "Nenhuma inscrição editada."
            : "Nenhuma resposta ainda. Compartilhe o link do formulário para começar a receber inscrições."
        }
        onRowClick={(row) => {
          // Busca a resposta completa correspondente da lista de responses
          const full = responses.find((r) => r.id === row.id);
          if (full) {
            setDetailRow(full);
          }
        }}
        renderRowActions={(r) => {
          const nameQ = findNameQuestion(questions);
          const nome =
            nameQ &&
            typeof r.answers?.[nameQ.id] === "string" &&
            (r.answers[nameQ.id] as string).trim()
              ? (r.answers[nameQ.id] as string).trim()
              : describeResponse(questions, r.answers);

          const full = responses.find((resp) => resp.id === r.id) || r;

          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setResponseToEdit(full as any)}
                aria-label={`Editar inscrição de ${nome}`}
                className="rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium ring-1 ring-black/5 hover:bg-white cursor-pointer"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleCopyEditLink((full as any).edit_token)}
                className="rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium ring-1 ring-black/5 hover:bg-white cursor-pointer"
              >
                Copiar link de edição
              </button>
              <button
                type="button"
                onClick={() => setResponseToDelete(full as any)}
                disabled={isDeleting}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Excluir
              </button>
            </div>
          );
        }}
      />

      {/* Card de Detalhes da Inscrição */}
      <ResponseDetailDialog
        open={detailRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailRow(null);
          }
        }}
        row={detailRow}
        questions={questions}
        whatsappContext={{ formTitle: form.title }}
        actions={
          detailRow ? (
            <>
              <button
                type="button"
                onClick={() => {
                  const target = detailRow;
                  setDetailRow(null);
                  setResponseToEdit(target);
                }}
                className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-black/10 hover:bg-white cursor-pointer"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleCopyEditLink(detailRow.edit_token)}
                className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-black/10 hover:bg-white cursor-pointer"
              >
                Copiar link de edição
              </button>
              <button
                type="button"
                onClick={() => setConfirmResendRow(detailRow)}
                disabled={!detailHasEmail || isResending}
                title={
                  detailHasEmail
                    ? "Reenviar e-mail de confirmação com link de edição"
                    : "Esta inscrição não possui e-mail cadastrado."
                }
                className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-black/10 hover:bg-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Reenviar e-mail
              </button>
              <button
                type="button"
                onClick={() => setResponseToDelete(detailRow)}
                disabled={isDeleting}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-destructive ring-1 ring-destructive/20 hover:bg-destructive/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Excluir
              </button>
            </>
          ) : null
        }
      />

      {/* Diálogo de confirmação para Reenviar E-mail do card */}
      <AlertDialog
        open={confirmResendRow !== null}
        onOpenChange={(open) => {
          if (!open && !isResending) {
            setConfirmResendRow(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar e-mail com link de edição?</AlertDialogTitle>
            <AlertDialogDescription>
              O e-mail de confirmação contendo o link de edição será reenviado para{" "}
              <strong className="font-semibold text-foreground break-all">
                {confirmResendRow
                  ? findEmailQuestionWithAnswer(questions, confirmResendRow.answers)?.email
                  : ""}
              </strong>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isResending}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmResendRow) return;
                try {
                  setIsResending(true);
                  const res = await resendEditLink({
                    data: { responseId: confirmResendRow.id },
                  });
                  if (res.sent) {
                    toast.success("E-mail reenviado com sucesso!");
                    setConfirmResendRow(null);
                  } else {
                    toast.error(res.error || "Não foi possível reenviar o e-mail.");
                  }
                } catch {
                  toast.error("Erro ao reenviar e-mail.");
                } finally {
                  setIsResending(false);
                }
              }}
              className="bg-brand text-primary-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {isResending ? "Enviando..." : "Confirmar reenvio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmação para Excluir Inscrição */}
      <AlertDialog
        open={responseToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setResponseToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta inscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto apaga de vez as respostas de{" "}
              {responseToDelete
                ? describeResponse(questions, responseToDelete.answers)
                : "esta pessoa"}{" "}
              (enviada em{" "}
              {responseToDelete
                ? new Date(responseToDelete.submitted_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : ""}
              ). O CPF e a vaga voltam a ficar livres e o link de edição deixa de funcionar.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteResponse();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isDeleting ? "Excluindo..." : "Excluir inscrição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminEditResponseDialog
        open={responseToEdit !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResponseToEdit(null);
          }
        }}
        response={responseToEdit}
        questions={questions}
        onSuccess={() => {
          query.refetch();
        }}
      />
    </section>
  );
}
