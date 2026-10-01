import { Link } from "@tanstack/react-router";
import type { LegalDocument } from "@/content/legal";
import { parseInline } from "@/lib/legal-inline";

interface LegalPageProps {
  document: LegalDocument;
  otherLink: {
    to: string;
    label: string;
  };
}

export function LegalPage({ document: doc, otherLink }: LegalPageProps) {
  return (
    <div className="flex min-h-screen items-start justify-center px-5 py-10 sm:py-16">
      <div className="glass-strong rise w-full max-w-2xl rounded-2xl p-6 sm:p-8">
        <header className="border-b border-black/5 pb-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {doc.title}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Última atualização: {doc.updatedAt}
          </p>
        </header>

        <article className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
          {doc.paragraphs.map((p, idx) => (
            <p key={idx}>
              {parseInline(p).map((node, nIdx) =>
                node.bold ? (
                  <strong key={nIdx} className="font-semibold text-foreground">
                    {node.text}
                  </strong>
                ) : (
                  <span key={nIdx}>{node.text}</span>
                )
              )}
            </p>
          ))}
        </article>

        <footer className="mt-8 border-t border-black/5 pt-6 text-sm">
          <div>
            <Link
              to={otherLink.to}
              className="font-medium underline hover:text-foreground text-brand"
            >
              {otherLink.label}
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Você pode fechar esta aba para voltar ao formulário.
          </p>
        </footer>
      </div>
    </div>
  );
}
