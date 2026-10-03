import { useState, useMemo, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import {
  findNameQuestion,
  filterRows,
  sortRows,
  type TableQuestion,
  type TableRow,
  type SortMode,
} from "@/lib/responses-table";
import { formatAnswer } from "@/lib/answer-format";
import { isEdited } from "@/lib/responses-view";

export interface ResponsesTableProps {
  questions: TableQuestion[];
  rows: TableRow[];
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  showUpdatedAt?: boolean;
  renderRowActions?: (row: TableRow) => ReactNode;
  onRowClick?: (row: TableRow) => void;
  emptyMessage?: string;
}

export function ResponsesTable({
  questions,
  rows,
  sortMode,
  onSortModeChange,
  showUpdatedAt = false,
  renderRowActions,
  onRowClick,
  emptyMessage,
}: ResponsesTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const nameQuestion = useMemo(() => findNameQuestion(questions), [questions]);

  // Se houver pergunta de nome, ela vira a primeira coluna. As demais seguem a ordem original.
  const orderedQuestions = useMemo(() => {
    if (!nameQuestion) return questions;
    const others = questions.filter((q) => q.id !== nameQuestion.id);
    return [nameQuestion, ...others];
  }, [questions, nameQuestion]);

  const filteredAndSortedRows = useMemo(() => {
    const filtered = filterRows(rows, questions, searchQuery);
    return sortRows(filtered, questions, sortMode);
  }, [rows, questions, searchQuery, sortMode]);

  const cell = (fieldType: string | undefined, value: string | string[] | undefined) => {
    const formatted = formatAnswer(fieldType, value);
    return formatted === "" ? "—" : formatted;
  };

  return (
    <div className="space-y-3">
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Buscar inscrição"
              placeholder="Buscar por nome, CPF, e-mail, telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-white/80 pl-9 pr-8 py-2 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="sort-select" className="sr-only">
              Ordem das inscrições
            </label>
            <select
              id="sort-select"
              aria-label="Ordem das inscrições"
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as SortMode)}
              className="rounded-lg bg-white/80 px-3 py-2 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none cursor-pointer"
            >
              <option value="newest">Mais recentes primeiro</option>
              <option value="oldest">Mais antigas primeiro</option>
              {nameQuestion && (
                <>
                  <option value="name_asc">Nome (A a Z)</option>
                  <option value="name_desc">Nome (Z a A)</option>
                </>
              )}
            </select>
          </div>
        </div>

        <p aria-live="polite" className="text-xs text-muted-foreground whitespace-nowrap">
          Mostrando {filteredAndSortedRows.length} de {rows.length} inscrições
        </p>
      </div>

      {/* Conteúdo da Tabela */}
      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {emptyMessage ||
              "Nenhuma resposta ainda. Compartilhe o link do formulário para começar a receber inscrições."}
          </p>
        </div>
      ) : filteredAndSortedRows.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma inscrição encontrada para “{searchQuery}”.
          </p>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Tabela de inscrições"
          tabIndex={0}
          className="relative max-h-[70vh] overflow-auto rounded-2xl glass ring-1 ring-black/5 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
        >
          <table className="w-full min-w-[640px] text-left text-sm border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-sm text-xs uppercase tracking-wide text-muted-foreground shadow-sm">
              <tr>
                {nameQuestion ? (
                  <>
                    <th className="sticky left-0 z-30 bg-slate-100/95 px-4 py-2 font-medium whitespace-nowrap shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                      {nameQuestion.label}
                    </th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">Enviado em</th>
                    {showUpdatedAt && (
                      <th className="px-4 py-2 font-medium whitespace-nowrap">Atualizado em</th>
                    )}
                    {orderedQuestions.slice(1).map((q) => (
                      <th key={q.id} className="px-4 py-2 font-medium whitespace-nowrap">
                        {q.label}
                      </th>
                    ))}
                  </>
                ) : (
                  <>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">Enviado em</th>
                    {showUpdatedAt && (
                      <th className="px-4 py-2 font-medium whitespace-nowrap">Atualizado em</th>
                    )}
                    {questions.map((q) => (
                      <th key={q.id} className="px-4 py-2 font-medium whitespace-nowrap">
                        {q.label}
                      </th>
                    ))}
                  </>
                )}
                {renderRowActions && (
                  <th className="px-4 py-2 font-medium whitespace-nowrap text-right sm:text-left">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filteredAndSortedRows.map((r) => {
                const edited = isEdited(r.submitted_at, r.updated_at);
                const rowNameVal = nameQuestion ? r.answers?.[nameQuestion.id] : null;
                const rowName =
                  typeof rowNameVal === "string" && rowNameVal.trim()
                    ? rowNameVal.trim()
                    : "esta inscrição";

                const isClickable = Boolean(onRowClick);

                // Determina a cor de fundo da linha para a coluna sticky bater exatamente
                const rowBgClass = edited
                  ? "bg-amber-50/70 hover:bg-amber-100/80"
                  : "odd:bg-white/40 even:bg-white/10 hover:bg-white/80";

                const stickyBgClass = edited
                  ? "bg-amber-50 group-hover:bg-amber-100"
                  : "bg-slate-50 group-odd:bg-slate-50 group-even:bg-white group-hover:bg-slate-100";

                return (
                  <tr
                    key={r.id}
                    data-clickable={isClickable ? "true" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-label={isClickable ? `Abrir detalhes da inscrição de ${rowName}` : undefined}
                    onClick={() => {
                      if (!onRowClick) return;
                      const selection = window.getSelection();
                      if (selection && selection.toString().trim().length > 0) {
                        return;
                      }
                      onRowClick(r);
                    }}
                    onKeyDown={(e) => {
                      if (!onRowClick) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(r);
                      }
                    }}
                    className={`group transition-colors ${rowBgClass} ${
                      isClickable
                        ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                        : ""
                    }`}
                  >
                    {nameQuestion ? (
                      <>
                        <td
                          className={`sticky left-0 z-10 px-4 py-2 font-medium text-foreground whitespace-nowrap shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] ${stickyBgClass}`}
                        >
                          {cell(nameQuestion.field_type, r.answers?.[nameQuestion.id])}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                          {new Date(r.submitted_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        {showUpdatedAt && (
                          <td className="px-4 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                            {edited && r.updated_at ? (
                              <span className="inline-flex items-center gap-1.5 text-foreground">
                                <span>
                                  {new Date(r.updated_at).toLocaleString("pt-BR", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </span>
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                                  Editada
                                </span>
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}
                        {orderedQuestions.slice(1).map((q) => {
                          const isLongText = q.field_type === "long_text";
                          return (
                            <td
                              key={q.id}
                              className={`px-4 py-2 ${
                                isLongText
                                  ? "max-w-[20rem] whitespace-normal break-words"
                                  : "whitespace-nowrap"
                              }`}
                            >
                              {cell(q.field_type, r.answers?.[q.id])}
                            </td>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                          {new Date(r.submitted_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        {showUpdatedAt && (
                          <td className="px-4 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                            {edited && r.updated_at ? (
                              <span className="inline-flex items-center gap-1.5 text-foreground">
                                <span>
                                  {new Date(r.updated_at).toLocaleString("pt-BR", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </span>
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                                  Editada
                                </span>
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}
                        {questions.map((q) => {
                          const isLongText = q.field_type === "long_text";
                          return (
                            <td
                              key={q.id}
                              className={`px-4 py-2 ${
                                isLongText
                                  ? "max-w-[20rem] whitespace-normal break-words"
                                  : "whitespace-nowrap"
                              }`}
                            >
                              {cell(q.field_type, r.answers?.[q.id])}
                            </td>
                          );
                        })}
                      </>
                    )}

                    {renderRowActions && (
                      <td
                        className="px-4 py-2 whitespace-nowrap text-right sm:text-left"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {renderRowActions(r)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
