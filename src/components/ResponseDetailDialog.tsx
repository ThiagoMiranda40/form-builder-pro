import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  findNameQuestion,
  type TableQuestion,
  type TableRow,
} from "@/lib/responses-table";
import { formatAnswer } from "@/lib/answer-format";
import { isEdited } from "@/lib/responses-view";
import { firstNameOf, whatsappGreeting, whatsappUrl } from "@/lib/whatsapp";

export interface ResponseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: TableRow | null;
  questions: TableQuestion[];
  actions?: ReactNode;
  whatsappContext?: { formTitle: string };
}

export function ResponseDetailDialog({
  open,
  onOpenChange,
  row,
  questions,
  actions,
  whatsappContext,
}: ResponseDetailDialogProps) {
  if (!row) return null;

  const nameQ = findNameQuestion(questions);
  const nameVal = nameQ ? row.answers?.[nameQ.id] : null;
  const firstName = firstNameOf(nameVal);
  const nameStr =
    typeof nameVal === "string" && nameVal.trim()
      ? nameVal.trim()
      : "Detalhes da inscrição";

  const submittedStr = new Date(row.submitted_at).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const edited = isEdited(row.submitted_at, row.updated_at);
  const updatedStr =
    edited && row.updated_at
      ? new Date(row.updated_at).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-full sm:max-w-xl p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground break-words">
            {nameStr}
          </DialogTitle>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Enviado em: <strong className="font-medium text-foreground">{submittedStr}</strong>
            </span>
            {updatedStr && (
              <span className="inline-flex items-center gap-1.5">
                <span>
                  Atualizado em: <strong className="font-medium text-foreground">{updatedStr}</strong>
                </span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                  Editada
                </span>
              </span>
            )}
          </div>
        </DialogHeader>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 border-y border-black/5 py-3">
            {actions}
          </div>
        )}

        <div className="space-y-3 pt-2">
          {questions.map((q) => {
            const rawVal = row.answers?.[q.id];
            const formatted = formatAnswer(q.field_type, rawVal);

            let waUrl: string | null = null;
            if (whatsappContext && q.field_type === "phone") {
              const greeting = whatsappGreeting(firstName, whatsappContext.formTitle);
              waUrl = whatsappUrl(rawVal, greeting);
            }

            return (
              <div
                key={q.id}
                className="rounded-lg bg-slate-50/80 p-3 ring-1 ring-black/5"
              >
                <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {q.label}
                </span>
                {waUrl ? (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground break-words whitespace-pre-wrap">
                      {formatted || "—"}
                    </p>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={
                        firstName
                          ? `Abrir conversa no WhatsApp com ${firstName}`
                          : "Abrir conversa no WhatsApp"
                      }
                      title="Abre o WhatsApp com uma mensagem inicial, que você pode editar antes de enviar"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 cursor-pointer"
                    >
                      <MessageCircle size={14} className="size-3.5" aria-hidden="true" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-medium text-foreground break-words whitespace-pre-wrap">
                    {formatted || "—"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
