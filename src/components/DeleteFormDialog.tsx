// src/components/DeleteFormDialog.tsx
import { useEffect, useState } from "react";
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
import type { DeleteFormCopyResult } from "@/lib/delete-form-copy";

export interface DeleteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: DeleteFormCopyResult | null;
  pending: boolean;
  onConfirm: () => void;
}

/**
 * Diálogo acessível para exclusão de formulários no painel.
 * - Apresenta aviso contextual de perda de dados e de formulário publicado.
 * - Exige marcação de checkbox de ciência quando houver respostas registradas.
 * - Foco inicial seguro no botão Cancelar.
 * - Não fecha automaticamente o diálogo no clique de confirmar (aguarda o pai concluir).
 */
export function DeleteFormDialog({
  open,
  onOpenChange,
  copy,
  pending,
  onConfirm,
}: DeleteFormDialogProps) {
  const [ackChecked, setAckChecked] = useState(false);

  // Sempre desmarcada ao abrir o diálogo
  useEffect(() => {
    if (open) {
      setAckChecked(false);
    }
  }, [open]);

  if (!copy) {
    return null;
  }

  const isConfirmDisabled = pending || (copy.requireAck && !ackChecked);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) {
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.heading}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{copy.description}</p>
              {copy.openWarning && (
                <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 ring-1 ring-amber-200/80">
                  {copy.openWarning}
                </p>
              )}
              {copy.requireAck && copy.ackLabel && (
                <div className="mt-2 flex items-start gap-2 pt-1 text-xs text-foreground">
                  <input
                    id="delete-form-ack-checkbox"
                    type="checkbox"
                    checked={ackChecked}
                    disabled={pending}
                    onChange={(e) => setAckChecked(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                  />
                  <label
                    htmlFor="delete-form-ack-checkbox"
                    className="cursor-pointer select-none leading-snug"
                  >
                    {copy.ackLabel}
                  </label>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isConfirmDisabled}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? copy.pendingLabel : copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
