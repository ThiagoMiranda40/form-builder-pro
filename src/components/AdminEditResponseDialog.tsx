import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { QuestionField } from "@/components/QuestionField";
import { findEmailQuestionWithAnswer } from "@/lib/admin-response";
import { adminUpdateResponse, resendEditLink } from "@/lib/admin-response.functions";

export interface AdminEditResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  response: {
    id: string;
    answers: Record<string, string | string[]>;
    identifier?: string | null;
  } | null;
  questions: {
    id: string;
    label: string;
    field_type?: string;
    required?: boolean;
    options?: string[];
    help_text?: string | null;
  }[];
  onSuccess: () => void;
}

export function AdminEditResponseDialog({
  open,
  onOpenChange,
  response,
  questions,
  onSuccess,
}: AdminEditResponseDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Estados de confirmação dentro do diálogo
  const [emailChangedPrompt, setEmailChangedPrompt] = useState<{
    newEmail: string;
  } | null>(null);
  const [confirmResendEmail, setConfirmResendEmail] = useState<string | null>(null);

  // Inicializa respostas quando abre
  useEffect(() => {
    if (open && response) {
      setAnswers({ ...response.answers });
      setFieldErrors({});
      setEmailChangedPrompt(null);
      setConfirmResendEmail(null);
    }
  }, [open, response]);

  // Temporizador de 60 segundos de cooldown para o botão de reenvio
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!response) return null;

  const savedIdentifierDigits = response.identifier
    ? response.identifier.replace(/\D/g, "")
    : "";

  const isCpfField = (q: { id: string; field_type?: string }) => {
    if (q.field_type === "cpf") return true;
    const savedVal = response.answers?.[q.id];
    if (typeof savedVal === "string") {
      const savedDigits = savedVal.replace(/\D/g, "");
      if (savedIdentifierDigits !== "" && savedDigits === savedIdentifierDigits) {
        return true;
      }
    }
    return false;
  };

  const handleFieldChange = (questionId: string, val: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
    if (fieldErrors[questionId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isResending) return;

    try {
      setIsSaving(true);
      setFieldErrors({});

      const result = await adminUpdateResponse({
        data: {
          responseId: response.id,
          answers,
        },
      });

      if (!result.ok) {
        if (result.field) {
          setFieldErrors({ [result.field]: result.error });
        }
        toast.error(result.error);
        return;
      }

      toast.success("Inscrição atualizada.");
      onSuccess();

      if (result.emailChanged && result.newEmail) {
        setEmailChangedPrompt({ newEmail: result.newEmail });
      } else {
        onOpenChange(false);
      }
    } catch {
      toast.error("Não foi possível salvar as alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteResend = async () => {
    if (!response || isResending || resendCooldown > 0) return;

    try {
      setIsResending(true);
      const res = await resendEditLink({
        data: { responseId: response.id },
      });

      if (res.sent) {
        toast.success("E-mail com o link de edição enviado.");
        setResendCooldown(60);
        setConfirmResendEmail(null);
      } else {
        toast.error(res.error || "Não foi possível enviar o e-mail. Tente novamente.");
      }
    } catch {
      toast.error("Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setIsResending(false);
    }
  };

  const handleSendChangedEmail = async () => {
    await handleExecuteResend();
    onOpenChange(false);
  };

  const currentEmailInfo = findEmailQuestionWithAnswer(questions, answers);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && (isSaving || isResending)) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {emailChangedPrompt ? (
          <div className="space-y-4 py-2">
            <DialogHeader>
              <DialogTitle>E-mail alterado</DialogTitle>
              <DialogDescription>
                O e-mail foi alterado. Enviar o e-mail de confirmação com o link de edição
                para <span className="font-semibold text-foreground break-all">{emailChangedPrompt.newEmail}</span>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isResending}
                className="rounded-lg bg-white/70 px-4 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-50"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={handleSendChangedEmail}
                disabled={isResending}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 disabled:opacity-50"
              >
                {isResending ? "Enviando..." : "Enviar agora"}
              </button>
            </DialogFooter>
          </div>
        ) : confirmResendEmail ? (
          <div className="space-y-4 py-2">
            <DialogHeader>
              <DialogTitle>Reenviar link de edição</DialogTitle>
              <DialogDescription>
                Deseja reenviar o e-mail com o link de edição para{" "}
                <span className="font-semibold text-foreground break-all">{confirmResendEmail}</span>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResendEmail(null)}
                disabled={isResending}
                className="rounded-lg bg-white/70 px-4 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteResend}
                disabled={isResending}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 disabled:opacity-50"
              >
                {isResending ? "Enviando..." : "Reenviar e-mail"}
              </button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Editar inscrição</DialogTitle>
              <DialogDescription>
                Altere as respostas da inscrição. O CPF não pode ser modificado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {questions.map((q) => {
                const isCpf = isCpfField(q);
                return (
                  <QuestionField
                    key={q.id}
                    question={{
                      id: q.id,
                      label: q.label,
                      help_text: q.help_text ?? null,
                      field_type: q.field_type ?? "text",
                      required: Boolean(q.required),
                      options: q.options ?? [],
                    }}
                    value={answers[q.id]}
                    error={fieldErrors[q.id]}
                    readOnly={isCpf}
                    readOnlyNotice={isCpf ? "O CPF não pode ser alterado." : undefined}
                    onChange={(val) => handleFieldChange(q.id, val)}
                  />
                );
              })}
            </div>

            <div className="border-t border-black/5 pt-3">
              <button
                type="button"
                onClick={() => {
                  if (!currentEmailInfo) {
                    toast.error("Esta inscrição não possui e-mail cadastrado.");
                    return;
                  }
                  setConfirmResendEmail(currentEmailInfo.email);
                }}
                disabled={isSaving || isResending || resendCooldown > 0}
                className="w-full rounded-lg bg-white/70 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-black/5 hover:bg-white disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Aguarde ${resendCooldown}s para reenviar`
                  : "Reenviar e-mail com o link de edição"}
              </button>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isSaving || isResending}
                className="rounded-lg bg-white/70 px-4 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || isResending}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
