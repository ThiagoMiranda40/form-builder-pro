import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ALLOWED_ORIGINS } from "@/lib/submit-response";
import { buildShareUrl } from "@/lib/share";
import {
  createShareLink,
  regenerateAccessCode,
  revokeShareLink,
} from "@/lib/share.functions";
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
  const [isProtected, setIsProtected] = useState<boolean | null>(null);
  const [oneTimeCode, setOneTimeCode] = useState<string | null>(null);
  const [copyWarningVisible, setCopyWarningVisible] = useState(false);

  const [showProtectDialog, setShowProtectDialog] = useState(false);
  const [showRegenerateCodeDialog, setShowRegenerateCodeDialog] = useState(false);
  const [showRegenerateLinkDialog, setShowRegenerateLinkDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  const createShareLinkFn = useServerFn(createShareLink);
  const regenerateAccessCodeFn = useServerFn(regenerateAccessCode);
  const revokeShareLinkFn = useServerFn(revokeShareLink);

  const canonicalOrigin = ALLOWED_ORIGINS[0];
  const shareUrl = shareToken ? buildShareUrl(canonicalOrigin, shareToken) : "";
  const skipNextStatusCheckRef = useRef(false);

  useEffect(() => {
    if (!shareToken) {
      setIsProtected(null);
      setOneTimeCode(null);
      setCopyWarningVisible(false);
      return;
    }
    if (skipNextStatusCheckRef.current) {
      skipNextStatusCheckRef.current = false;
      return;
    }
    let cancelled = false;
    createShareLinkFn({ data: { formId, regenerate: false } })
      .then((res) => {
        if (cancelled || !res.ok) return;
        if ("accessCode" in res) {
          setIsProtected(true);
          setOneTimeCode(res.accessCode);
        } else {
          setIsProtected(res.protected);
        }
      })
      .catch(() => {
        // Falha silenciosa na consulta de status; botões de ação continuam disponíveis
      });
    return () => {
      cancelled = true;
    };
  }, [formId, shareToken, createShareLinkFn]);

  const handleGenerateLink = async (regenerate?: boolean) => {
    setLoading(true);
    try {
      const res = await createShareLinkFn({
        data: { formId, regenerate: Boolean(regenerate) },
      });

      if (res.ok) {
        skipNextStatusCheckRef.current = true;
        if ("accessCode" in res) {
          setIsProtected(true);
          setOneTimeCode(res.accessCode);
        } else {
          setIsProtected(res.protected);
          setOneTimeCode(null);
        }
        setCopyWarningVisible(false);
        onShareTokenChange?.(res.shareToken);
        toast.success(
          regenerate
            ? "Novo link e código de acesso gerados!"
            : "Link privado e código de acesso gerados!",
        );
      } else {
        toast.error(res.error || "Não foi possível gerar o link.");
      }
    } catch {
      toast.error("Erro ao gerar o link do cliente.");
    } finally {
      setLoading(false);
      setShowRegenerateLinkDialog(false);
    }
  };

  const handleRegenerateCode = async (wasLegacy?: boolean) => {
    setLoading(true);
    try {
      const res = await regenerateAccessCodeFn({
        data: { formId },
      });

      if (res.ok) {
        setIsProtected(true);
        setOneTimeCode(res.accessCode);
        toast.success(
          wasLegacy
            ? "Link protegido com código de acesso!"
            : "Novo código de acesso gerado!",
        );
      } else {
        toast.error(res.error || "Não foi possível gerar o código de acesso.");
      }
    } catch {
      toast.error("Erro ao gerar o código de acesso.");
    } finally {
      setLoading(false);
      setShowProtectDialog(false);
      setShowRegenerateCodeDialog(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      const res = await revokeShareLinkFn({
        data: { formId },
      });

      if (res.ok) {
        setIsProtected(null);
        setOneTimeCode(null);
        setCopyWarningVisible(false);
        onShareTokenChange?.(null);
        toast.success("Link do cliente desativado.");
      } else {
        toast.error(res.error || "Não foi possível desativar o link.");
      }
    } catch {
      toast.error("Erro ao desativar o link do cliente.");
    } finally {
      setLoading(false);
      setShowRevokeDialog(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyWarningVisible(true);
      toast.warning(
        "Atenção: este link mostra dados pessoais dos inscritos. Envie só ao responsável.",
      );
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleCopyCode = async () => {
    if (!oneTimeCode) return;
    try {
      await navigator.clipboard.writeText(oneTimeCode);
      toast.success("Código de acesso copiado!");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  };

  return (
    <div className="rounded-2xl bg-amber-50/90 p-4 mt-4 ring-1 ring-amber-300/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-200/80 text-xs font-bold text-amber-950"
          >
            🔒
          </span>
          <h3 className="text-xs font-semibold text-amber-950">
            Link privado do cliente
          </h3>
        </div>
        {shareToken && isProtected === true && (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-300">
            Link protegido por código de acesso
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs text-amber-900/90">
        Mostra os dados dos inscritos. Compartilhe só com o responsável, junto com o código de acesso, de preferência por outro canal.
      </p>

      {!shareToken ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleGenerateLink(false)}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-brand/90 disabled:opacity-60 cursor-pointer"
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
              aria-label="URL do link privado do cliente"
              className="min-w-[260px] flex-1 rounded-lg bg-white/95 px-3 py-2 text-xs ring-1 ring-amber-300/80 select-all focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-brand/90 cursor-pointer"
            >
              Copiar
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/90 px-3 py-2 text-xs font-medium text-amber-950 ring-1 ring-amber-300/80 hover:bg-white"
            >
              Abrir
            </a>
          </div>

          {copyWarningVisible && (
            <p
              role="status"
              className="rounded-lg bg-amber-100/90 px-3 py-2 text-xs font-medium text-amber-950 ring-1 ring-amber-300"
            >
              Atenção: este link mostra dados pessoais dos inscritos. Envie só ao responsável.
            </p>
          )}

          {oneTimeCode && (
            <div
              role="region"
              aria-label="Código de acesso recém-gerado"
              className="rounded-xl bg-white p-3.5 ring-2 ring-amber-400 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-amber-900">
                    Código de acesso
                  </span>
                  <code className="block font-mono text-base font-bold tracking-widest text-slate-900 select-all">
                    {oneTimeCode}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-brand/90 cursor-pointer"
                  >
                    Copiar código
                  </button>
                  <button
                    type="button"
                    onClick={() => setOneTimeCode(null)}
                    className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    Já anotei
                  </button>
                </div>
              </div>
              <p className="text-xs text-amber-950">
                Anote ou envie agora. Este código não aparece de novo. Se perder, gere um novo código: o link continua o mesmo, mas quem já entrou precisará digitar o novo código.
              </p>
            </div>
          )}

          {isProtected === false && !oneTimeCode && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-100/90 p-3 ring-1 ring-amber-300"
            >
              <p className="text-xs font-medium text-amber-950">
                Este link não tem código de acesso. Quem tiver o endereço vê os dados.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowProtectDialog(true)}
                className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950 disabled:opacity-60 cursor-pointer"
              >
                Proteger com código
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isProtected !== false && (
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowRegenerateCodeDialog(true)}
                className="rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-medium text-slate-800 ring-1 ring-amber-300/80 hover:bg-white disabled:opacity-60 cursor-pointer"
              >
                Gerar novo código
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowRegenerateLinkDialog(true)}
              className="rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-medium text-slate-800 ring-1 ring-amber-300/80 hover:bg-white disabled:opacity-60 cursor-pointer"
            >
              Gerar novo link e código
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowRevokeDialog(true)}
              className="rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-medium text-destructive ring-1 ring-amber-300/80 hover:bg-red-50 disabled:opacity-60 cursor-pointer"
            >
              Desativar link
            </button>
          </div>
        </div>
      )}

      {/* Diálogo de confirmação para Proteger com código (link legado) */}
      <AlertDialog open={showProtectDialog} onOpenChange={setShowProtectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proteger este link com código de acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              O endereço do link continuará o mesmo, mas quem acessar precisará digitar o código de acesso que será gerado agora. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={() => handleRegenerateCode(true)}
            >
              {loading ? "Protegendo..." : "Proteger com código"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmação para Gerar novo código */}
      <AlertDialog
        open={showRegenerateCodeDialog}
        onOpenChange={setShowRegenerateCodeDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo código de acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              O endereço do link continuará o mesmo, mas o código anterior deixará de funcionar e quem já tinha aberto precisará digitar o novo código. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={() => handleRegenerateCode(false)}
            >
              {loading ? "Gerando..." : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmação para Gerar novo link e código */}
      <AlertDialog
        open={showRegenerateLinkDialog}
        onOpenChange={setShowRegenerateLinkDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link e código?</AlertDialogTitle>
            <AlertDialogDescription>
              O link e o código atuais deixarão de funcionar na hora. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={() => handleGenerateLink(true)}
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
