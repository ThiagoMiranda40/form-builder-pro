import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ALLOWED_ORIGINS } from "@/lib/submit-response";
import { buildShareUrl } from "@/lib/share";
import { createShareLink, revokeShareLink } from "@/lib/share.functions";
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

interface ShareLinkCardProps {
  formId: string;
  shareToken: string | null;
  onShareTokenChange?: (token: string | null) => void;
}

export function ShareLinkCard({
  formId,
  shareToken,
  onShareTokenChange,
}: ShareLinkCardProps) {
  const [loading, setLoading] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  const createShareLinkFn = useServerFn(createShareLink);
  const revokeShareLinkFn = useServerFn(revokeShareLink);

  const canonicalOrigin = ALLOWED_ORIGINS[0];
  const shareUrl = shareToken ? buildShareUrl(canonicalOrigin, shareToken) : "";

  const handleGenerate = async (regenerate?: boolean) => {
    setLoading(true);
    try {
      const res = await createShareLinkFn({
        data: { formId, regenerate: Boolean(regenerate) },
      });

      if (res.ok) {
        onShareTokenChange?.(res.shareToken);
        toast.success(
          regenerate
            ? "Novo link do cliente gerado!"
            : "Link do cliente gerado com sucesso!"
        );
      } else {
        toast.error(res.error || "Não foi possível gerar o link.");
      }
    } catch (err) {
      toast.error("Erro ao gerar o link do cliente.");
    } finally {
      setLoading(false);
      setShowRegenerateDialog(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      const res = await revokeShareLinkFn({
        data: { formId },
      });

      if (res.ok) {
        onShareTokenChange?.(null);
        toast.success("Link do cliente desativado.");
      } else {
        toast.error(res.error || "Não foi possível desativar o link.");
      }
    } catch (err) {
      toast.error("Erro ao desativar o link do cliente.");
    } finally {
      setLoading(false);
      setShowRevokeDialog(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado!");
    } catch (err) {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="glass rounded-2xl p-4 mt-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <h3 className="text-xs font-semibold text-slate-800">
          Link do cliente (somente leitura)
        </h3>
      </div>

      <p className="mt-1 text-xs text-slate-600">
        Quem tiver este link vê todas as inscrições, inclusive CPF, e-mail e telefone,
        mas não consegue alterar nada. Compartilhe só com quem precisa.
      </p>

      {!shareToken ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleGenerate(false)}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            {loading ? "Gerando link..." : "Gerar link do cliente"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label="URL do link do cliente"
              className="min-w-[260px] flex-1 rounded-lg bg-white/80 px-3 py-2 text-xs ring-1 ring-black/5 select-all focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-brand/90"
            >
              Copiar
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/70 px-3 py-2 text-xs font-medium ring-1 ring-black/5 hover:bg-white"
            >
              Abrir
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowRegenerateDialog(true)}
              className="rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-black/5 hover:bg-white disabled:opacity-60"
            >
              Gerar novo link
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowRevokeDialog(true)}
              className="rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium text-destructive ring-1 ring-black/5 hover:bg-red-50 disabled:opacity-60"
            >
              Desativar link
            </button>
          </div>
        </div>
      )}

      {/* Diálogo de confirmação para Regenerar Link */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link do cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual deixará de funcionar na hora. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={() => handleGenerate(true)}
            >
              {loading ? "Gerando..." : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmação para Desativar Link */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar link do cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Quem usa o link perderá o acesso na hora. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Desativando..." : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
