import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FIELD_TYPES, type FieldType } from "@/lib/validators";
import { mapSlugDbError, sanitizeSlugInput, trimSlugEdges, validateSlug } from "@/lib/slug";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import {
  normalizePositions,
  moveByStep,
  moveToIndex,
  insertionIndex,
  insertAfter,
  moveAnnouncement,
  positionsToPersist,
} from "@/lib/question-order";
import { editorSnapshot, isEditorDirty } from "@/lib/editor-dirty";
import {
  QuestionEditFields,
  Field,
  inputClass,
} from "@/components/QuestionEditFields";
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
import { StatusPill } from "./_authenticated.painel";

export const Route = createFileRoute("/_authenticated/formularios/$id")({
  head: () => ({
    meta: [
      { title: "Editor de formulário — FormulárioLab" },
      {
        name: "description",
        content:
          "Monte as perguntas, escolha tipos de campo, personalize cores e defina limites de respostas e prazo.",
      },
      { property: "og:title", content: "Editor de formulário — FormulárioLab" },
      { property: "og:description", content: "Monte perguntas, personalize e publique." },
    ],
  }),
  component: Editor,
});

type Question = {
  id: string;
  label: string;
  help_text: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
  position: number;
};

type Theme = { color: string; font: string; logo_url: string | null };

type FormState = {
  title: string;
  description: string;
  slug: string;
  status: string;
  theme: Theme;
  max_responses: number | null;
  closes_at: string | null;
  consent_text: string | null;
  success_message: string;
  share_token: string | null;
};

const toLocalInput = (value: string | null) =>
  value ? new Date(new Date(value).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "";

function Editor() {
  const { id } = useParams({ from: "/_authenticated/formularios/$id" });
  const [form, setForm] = useState<FormState | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"aparencia" | "limites">("aparencia");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [initialSlug, setInitialSlug] = useState<string>("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Estados de arrastar (DND nativo) e acessibilidade
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  // Estado de exclusão com confirmação (AlertDialog)
  const [questionToDelete, setQuestionToDelete] = useState<{ id: string; index: number } | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  // Limpeza de justAddedId no próximo quadro para foco de uso único (T-34b)
  useEffect(() => {
    if (!justAddedId) return;
    const raf = requestAnimationFrame(() => {
      setJustAddedId(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [justAddedId]);

  useEffect(() => {
    const el = descriptionTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form?.description]);

  const query = useQuery({
    queryKey: ["form", id],
    queryFn: async () => {
      const [formRes, questionsRes] = await Promise.all([
        supabase.from("forms").select("*").eq("id", id).single(),
        supabase.from("questions").select("*").eq("form_id", id).order("position"),
      ]);
      if (formRes.error) throw formRes.error;
      if (questionsRes.error) throw questionsRes.error;
      return { form: formRes.data, questions: questionsRes.data ?? [] };
    },
  });

  useEffect(() => {
    if (!query.data) return;
    const f = query.data.form as Record<string, unknown>;
    const loadedSlug = (f["slug"] as string) ?? "";
    setInitialSlug(loadedSlug);
    setSlugError(null);
    const loadedForm: FormState = {
      title: f["title"] as string,
      description: (f["description"] as string) ?? "",
      slug: loadedSlug,
      status: f["status"] as string,
      theme: (f["theme"] as Theme) ?? { color: "#4f46e5", font: "body", logo_url: null },
      max_responses: (f["max_responses"] as number | null) ?? null,
      closes_at: (f["closes_at"] as string | null) ?? null,
      consent_text: (f["consent_text"] as string | null) ?? null,
      success_message: (f["success_message"] as string) ?? "",
      share_token: (f["share_token"] as string | null) ?? null,
    };
    const loadedQuestions: Question[] = (query.data.questions as Record<string, unknown>[]).map((q) => ({
      id: q["id"] as string,
      label: (q["label"] as string) ?? "",
      help_text: (q["help_text"] as string) ?? "",
      field_type: q["field_type"] as FieldType,
      required: Boolean(q["required"]),
      options: ((q["options"] as string[]) ?? []) as string[],
      position: (q["position"] as number) ?? 0,
    }));
    setForm(loadedForm);
    setQuestions(loadedQuestions);
    setSavedSnapshot(editorSnapshot(loadedForm, loadedQuestions));
    setSelected((prev) => prev ?? ((query.data.questions[0] as { id?: string } | undefined)?.id ?? null));
  }, [query.data]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = form ? `${origin}/${form.slug}` : "";

  const dirty = isEditorDirty(editorSnapshot(form, questions), savedSnapshot);

  // Intercepta fechar a aba ou recarregar a página quando houver alterações não salvas (T-34b)
  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty]);

  function patchQuestion(questionId: string, patch: Partial<Question>) {
    setQuestions((list) => list.map((q) => (q.id === questionId ? { ...q, ...patch } : q)));
  }

  async function addQuestion(afterId: string | null | undefined = selected) {
    if (adding) return;
    setAdding(true);
    try {
      const targetPos = insertionIndex(questions, afterId);
      const { data, error } = await supabase
        .from("questions")
        .insert({
          form_id: id,
          label: "Nova pergunta",
          field_type: "short_text",
          position: targetPos,
        })
        .select("*")
        .single();

      if (error || !data) {
        toast.error("Não foi possível adicionar a pergunta.");
        return;
      }

      const newQuestion: Question = {
        id: data.id as string,
        label: "Nova pergunta",
        help_text: "",
        field_type: "short_text",
        required: false,
        options: [],
        position: targetPos,
      };

      const nextQuestions = insertAfter(questions, newQuestion, afterId);
      setQuestions(nextQuestions);
      setSelected(newQuestion.id);
      setJustAddedId(newQuestion.id);

      // Grava imediatamente no banco as novas posições de todas as perguntas exceto a inserida (T-34b)
      const updatedPositions = positionsToPersist(nextQuestions, newQuestion.id);

      if (updatedPositions.length > 0) {
        try {
          const results = await Promise.all(
            updatedPositions.map((q) =>
              supabase.from("questions").update({ position: q.position }).eq("id", q.id),
            ),
          );
          const hasError = results.some((r) => r.error);
          if (hasError) {
            toast.error(
              "Não foi possível reordenar as perguntas. Clique em Salvar para corrigir a ordem.",
            );
          }
        } catch {
          toast.error(
            "Não foi possível reordenar as perguntas. Clique em Salvar para corrigir a ordem.",
          );
        }
      }

      requestAnimationFrame(() => {
        const cardEl = document.getElementById(`question-card-${newQuestion.id}`);
        cardEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    } finally {
      setAdding(false);
    }
  }

  async function confirmRemoveQuestion() {
    if (!questionToDelete) return;
    const { id: questionId, index: deletedIndex } = questionToDelete;
    setDeletingQuestion(true);
    try {
      const { error } = await supabase.from("questions").delete().eq("id", questionId);
      if (error) {
        toast.error("Não foi possível excluir a pergunta.");
        return;
      }
      const nextQuestions = normalizePositions(questions.filter((q) => q.id !== questionId));
      setQuestions(nextQuestions);
      if (selected === questionId) setSelected(null);
      setJustAddedId(null);
      setQuestionToDelete(null);

      // Foco na pergunta seguinte, na anterior ou no botão adicionar
      requestAnimationFrame(() => {
        if (nextQuestions[deletedIndex]) {
          document.getElementById(`question-header-${nextQuestions[deletedIndex]?.id}`)?.focus();
        } else if (deletedIndex > 0 && nextQuestions[deletedIndex - 1]) {
          document.getElementById(`question-header-${nextQuestions[deletedIndex - 1]?.id}`)?.focus();
        } else {
          document.getElementById("add-question-btn")?.focus();
        }
      });
    } catch {
      toast.error("Não foi possível excluir a pergunta.");
    } finally {
      setDeletingQuestion(false);
    }
  }

  function handleMoveByStep(index: number, direction: -1 | 1) {
    const next = moveByStep(questions, index, direction);
    setQuestions(next);
    const newPos = index + direction;
    if (newPos >= 0 && newPos < next.length) {
      setLiveAnnouncement(moveAnnouncement(newPos, next.length));
    }
  }

  async function save(nextStatus?: string) {
    if (!form) return;
    const cleanSlug = trimSlugEdges(form.slug);
    const validationError = validateSlug(cleanSlug);
    if (validationError) {
      setSlugError(validationError);
      toast.error(validationError);
      return;
    }
    if (cleanSlug !== form.slug) {
      setForm((prev) => (prev ? { ...prev, slug: cleanSlug } : null));
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("forms")
        .update({
          title: form.title.trim() || "Sem título",
          description: form.description,
          slug: cleanSlug,
          theme: form.theme,
          max_responses: form.max_responses,
          closes_at: form.closes_at,
          consent_text: form.consent_text?.trim() ? form.consent_text.trim() : null,
          success_message: form.success_message,
          status: nextStatus ?? form.status,
        })
        .eq("id", id);
      if (error) {
        const slugDbError = mapSlugDbError(error);
        if (slugDbError) {
          setSlugError(slugDbError);
          toast.error(slugDbError);
          return;
        }
        throw error;
      }

      for (const q of questions) {
        const { error: qError } = await supabase
          .from("questions")
          .update({
            label: q.label.trim() || "Pergunta",
            help_text: q.help_text,
            field_type: q.field_type,
            required: q.required,
            options: q.options,
            position: q.position,
          })
          .eq("id", q.id);
        if (qError) throw qError;
      }
      setInitialSlug(cleanSlug);
      setSlugError(null);
      const updatedForm: FormState = {
        ...form,
        title: form.title.trim() || "Sem título",
        slug: cleanSlug,
        status: nextStatus ?? form.status,
        consent_text: form.consent_text?.trim() ? form.consent_text.trim() : null,
      };
      setForm(updatedForm);
      setSavedSnapshot(editorSnapshot(updatedForm, questions));
      toast.success(
        nextStatus === "published"
          ? "Formulário publicado! O link já pode ser compartilhado."
          : nextStatus === "closed"
            ? "Formulário encerrado."
            : "Alterações salvas.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  // Atalho de teclado Ctrl+S ou Cmd+S para salvar (T-34b)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) {
          saveRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [saving]);

  if (query.isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Carregando formulário...</p>;
  }

  return (
    <section className="rise space-y-4">
      {/* Região para anúncios de leitores de tela */}
      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/painel" className="text-sm text-muted-foreground hover:text-foreground">
          ← Painel
        </Link>
        <StatusPill status={form.status} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            to="/formularios/$id/respostas"
            params={{ id }}
            className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white"
          >
            Ver respostas
          </Link>
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {form.status === "published" ? (
            <button
              onClick={() => save("closed")}
              className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white"
            >
              Encerrar
            </button>
          ) : (
            <button
              onClick={() => save("published")}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90"
            >
              Publicar
            </button>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <label htmlFor="slug-input" className="text-xs font-medium text-muted-foreground">
          Link de compartilhamento
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[280px] items-center rounded-lg bg-white/80 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand/40">
            <span className="select-none rounded-l-lg bg-white/60 px-3 py-2 text-xs text-muted-foreground border-r border-black/5 whitespace-nowrap">
              {origin}/
            </span>
            <input
              id="slug-input"
              type="text"
              value={form.slug}
              aria-invalid={Boolean(slugError)}
              aria-describedby={slugError ? "slug-error" : undefined}
              onChange={(e) => {
                const nextSlug = sanitizeSlugInput(e.target.value);
                setForm((prev) => (prev ? { ...prev, slug: nextSlug } : null));
                setSlugError(validateSlug(nextSlug));
              }}
              onBlur={() => {
                const clean = trimSlugEdges(form.slug);
                if (clean !== form.slug) {
                  setForm((prev) => (prev ? { ...prev, slug: clean } : null));
                }
                setSlugError(validateSlug(clean));
              }}
              maxLength={60}
              placeholder="endereco-do-formulario"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (publicUrl) {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado!");
              }
            }}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-brand/90"
          >
            Copiar link
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/70 px-3 py-2 text-xs font-medium ring-1 ring-black/5 hover:bg-white"
          >
            Abrir
          </a>
        </div>

        {slugError && (
          <p id="slug-error" role="alert" className="mt-2 text-xs text-destructive">
            {slugError}
          </p>
        )}

        {form.status === "published" && form.slug !== initialSlug && (
          <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 ring-1 ring-amber-200">
            Atenção: como este formulário já está publicado, links já compartilhados deixarão de funcionar se você alterar o endereço.
          </div>
        )}

        {form.status !== "published" && (
          <p className="mt-2 text-xs text-amber-600">
            Publique o formulário para que o link aceite respostas.
          </p>
        )}
      </div>

      <ShareLinkCard
        formId={id}
        shareToken={form.share_token ?? null}
        onShareTokenChange={(newToken) => {
          setForm((prev) => (prev ? { ...prev, share_token: newToken } : null));
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass min-w-0 rounded-2xl p-5">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={120}
            className="w-full min-w-0 bg-transparent font-display text-2xl font-semibold tracking-tight focus:outline-none"
            placeholder="Título do formulário"
          />
          <textarea
            ref={descriptionTextareaRef}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={1000}
            rows={4}
            aria-label="Descrição do formulário"
            aria-describedby="description-counter"
            placeholder="Descrição exibida para quem for se inscrever. As quebras de linha que você digitar aparecem na tela de inscrição."
            className="mt-2 w-full min-w-0 resize-none rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-slate-700 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 overflow-y-auto"
            style={{ minHeight: "6rem", maxHeight: "24rem" }}
          />
          <div className="mt-1 flex justify-end">
            <span
              id="description-counter"
              className={`text-xs ${
                (form.description?.length ?? 0) >= 900
                  ? "font-medium text-amber-800"
                  : "text-slate-600"
              }`}
            >
              {form.description?.length ?? 0}/1000
            </span>
          </div>

          <ol className="mt-5 min-w-0 space-y-3">
            {questions.map((q, index) => {
              const isSelected = selected === q.id;
              const isDragged = draggedId === q.id;
              const isTargetBefore = dropTarget?.id === q.id && dropTarget.position === "before";
              const isTargetAfter = dropTarget?.id === q.id && dropTarget.position === "after";

              return (
                <li
                  key={q.id}
                  id={`question-card-${q.id}`}
                  draggable={activeDragId === q.id}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", q.id);
                    setDraggedId(q.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!draggedId || draggedId === q.id) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isTop = e.clientY < rect.top + rect.height / 2;
                    setDropTarget({ id: q.id, position: isTop ? "before" : "after" });
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dropTarget?.id === q.id) {
                      setDropTarget(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!draggedId || draggedId === q.id) {
                      setDraggedId(null);
                      setDropTarget(null);
                      setActiveDragId(null);
                      return;
                    }
                    const fromIndex = questions.findIndex((item) => item.id === draggedId);
                    const toQuestionIndex = questions.findIndex((item) => item.id === q.id);
                    if (fromIndex !== -1 && toQuestionIndex !== -1) {
                      let targetIndex = toQuestionIndex;
                      if (dropTarget?.position === "after" && fromIndex < toQuestionIndex) {
                        targetIndex = toQuestionIndex;
                      } else if (dropTarget?.position === "after" && fromIndex > toQuestionIndex) {
                        targetIndex = toQuestionIndex + 1;
                      } else if (dropTarget?.position === "before" && fromIndex < toQuestionIndex) {
                        targetIndex = toQuestionIndex - 1;
                      } else if (dropTarget?.position === "before" && fromIndex > toQuestionIndex) {
                        targetIndex = toQuestionIndex;
                      }
                      const nextList = moveToIndex(questions, fromIndex, targetIndex);
                      setQuestions(nextList);
                      const newPos = nextList.findIndex((item) => item.id === draggedId);
                      setLiveAnnouncement(moveAnnouncement(newPos, nextList.length));
                    }
                    setDraggedId(null);
                    setDropTarget(null);
                    setActiveDragId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDropTarget(null);
                    setActiveDragId(null);
                  }}
                  className={`min-w-0 rounded-xl bg-white/70 p-4 ring-1 transition-all ${
                    isSelected ? "ring-brand/50" : "ring-black/5 hover:ring-black/10"
                  } ${isDragged ? "opacity-50" : ""} ${
                    isTargetBefore ? "border-t-2 border-brand" : ""
                  } ${isTargetAfter ? "border-b-2 border-brand" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {/* Alça de arrastar nativo */}
                    <button
                      type="button"
                      aria-label={`Arrastar pergunta ${index + 1}`}
                      onPointerDown={() => setActiveDragId(q.id)}
                      onPointerUp={() => setActiveDragId(null)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-slate-700 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-brand/40 focus:outline-none"
                    >
                      <svg
                        aria-hidden="true"
                        className="size-4 pointer-events-none"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <circle cx="5" cy="3" r="1.5" />
                        <circle cx="11" cy="3" r="1.5" />
                        <circle cx="5" cy="8" r="1.5" />
                        <circle cx="11" cy="8" r="1.5" />
                        <circle cx="5" cy="13" r="1.5" />
                        <circle cx="11" cy="13" r="1.5" />
                      </svg>
                    </button>

                    {/* Botão de cabeçalho: seleciona e expande / recolhe */}
                    <button
                      id={`question-header-${q.id}`}
                      type="button"
                      aria-expanded={isSelected}
                      aria-controls={`question-fields-${q.id}`}
                      onClick={() => {
                        setJustAddedId(null);
                        if (isSelected) {
                          setSelected(null);
                        } else {
                          setSelected(q.id);
                        }
                      }}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-lg p-1 text-left focus-visible:ring-2 focus-visible:ring-brand/40 focus:outline-none cursor-pointer"
                    >
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-brand-soft text-xs font-semibold text-brand">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {q.label || "Pergunta sem título"}
                          {q.required && <span className="ml-1 text-destructive">*</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {FIELD_TYPES.find((t) => t.value === q.field_type)?.label ?? q.field_type}
                          {q.help_text ? ` · ${q.help_text}` : ""}
                        </p>
                      </div>
                    </button>

                    {/* Botões de controle FORA do botão de cabeçalho */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Mover pergunta ${index + 1} para cima`}
                        disabled={index === 0}
                        onClick={() => handleMoveByStep(index, -1)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand/40 focus:outline-none cursor-pointer"
                      >
                        <span aria-hidden="true" className="text-sm font-semibold">
                          ↑
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Mover pergunta ${index + 1} para baixo`}
                        disabled={index === questions.length - 1}
                        onClick={() => handleMoveByStep(index, 1)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand/40 focus:outline-none cursor-pointer"
                      >
                        <span aria-hidden="true" className="text-sm font-semibold">
                          ↓
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Adicionar pergunta abaixo da pergunta ${index + 1}`}
                        title="Adicionar uma pergunta logo abaixo desta"
                        disabled={adding}
                        onClick={() => addQuestion(q.id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand/40 focus:outline-none cursor-pointer"
                      >
                        <span aria-hidden="true" className="text-sm font-semibold">
                          +
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir pergunta ${index + 1}`}
                        onClick={() => setQuestionToDelete({ id: q.id, index })}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-destructive focus-visible:ring-2 focus-visible:ring-brand/40 focus:outline-none cursor-pointer"
                      >
                        <span aria-hidden="true" className="text-sm font-semibold">
                          ✕
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Edição na própria pergunta quando selecionada */}
                  {isSelected && (
                    <div
                      id={`question-fields-${q.id}`}
                      className="mt-4 border-t border-black/5 pt-4"
                    >
                      <QuestionEditFields
                        question={q}
                        onChange={(patch) => patchQuestion(q.id, patch)}
                        idPrefix={`card-${q.id}-`}
                        autoFocusLabel={justAddedId === q.id}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <button
            id="add-question-btn"
            type="button"
            disabled={adding}
            onClick={() => addQuestion()}
            className="mt-4 w-full rounded-xl border border-dashed border-brand/40 bg-white/40 py-3 text-sm font-medium text-brand hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-brand/40 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Adicionar pergunta
          </button>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            A nova pergunta entra logo abaixo da pergunta selecionada.
          </p>

          {/* Barra de salvar fixa (T-34b / M-35, T-34c / M-36) */}
          <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 glass-strong rounded-xl ring-1 ring-black/10 px-4 py-3">
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-slate-700">
              {dirty ? (
                <>
                  <span aria-hidden="true" className="size-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Alterações não salvas</span>
                </>
              ) : (
                <span>Tudo salvo</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={adding}
                title="Adiciona logo abaixo da pergunta selecionada ou, se nenhuma estiver selecionada, no fim da lista"
                onClick={() => addQuestion()}
                className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-black/10 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                + Adicionar pergunta
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => save()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90 disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>

        {/* Painel lateral com lg:sticky lg:top-24 */}
        <aside className="glass rounded-2xl p-5 lg:sticky lg:self-start lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="mb-4 flex gap-1 rounded-lg bg-white/60 p-1 text-xs">
            {(["aparencia", "limites"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium transition-colors cursor-pointer ${
                  tab === key ? "bg-brand text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {key === "aparencia" ? "Aparência" : "Limites e Termos"}
              </button>
            ))}
          </div>

          {tab === "aparencia" && (
            <div className="space-y-4">
              <Field label="Cor principal">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.theme.color}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, color: e.target.value } })}
                    className="h-9 w-12 rounded-md ring-1 ring-black/5"
                  />
                  <input
                    value={form.theme.color}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, color: e.target.value } })}
                    className={inputClass}
                  />
                </div>
              </Field>
              <Field label="Fonte">
                <select
                  value={form.theme.font}
                  onChange={(e) => setForm({ ...form, theme: { ...form.theme, font: e.target.value } })}
                  className={inputClass}
                >
                  <option value="body">Inter (moderna)</option>
                  <option value="display">Space Grotesk (destaque)</option>
                  <option value="serif">Serifada (clássica)</option>
                </select>
              </Field>
              <Field label="URL do logotipo">
                <input
                  value={form.theme.logo_url ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, theme: { ...form.theme, logo_url: e.target.value || null } })
                  }
                  maxLength={500}
                  className={inputClass}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Mensagem de sucesso">
                <textarea
                  rows={3}
                  value={form.success_message}
                  onChange={(e) => setForm({ ...form, success_message: e.target.value })}
                  maxLength={300}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {tab === "limites" && (
            <div className="space-y-4">
              <Field label="Limite de respostas / vagas">
                <input
                  type="number"
                  min={1}
                  value={form.max_responses ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, max_responses: e.target.value ? Number(e.target.value) : null })
                  }
                  className={inputClass}
                  placeholder="Deixe vazio para ilimitado"
                />
              </Field>
              <Field label="Prazo final (data e hora)">
                <input
                  type="datetime-local"
                  value={toLocalInput(form.closes_at)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      closes_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Texto de consentimento (LGPD)">
                <textarea
                  rows={4}
                  value={form.consent_text ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, consent_text: e.target.value || null })
                  }
                  className={inputClass}
                  placeholder="Declaro que li e concordo com o regulamento do evento..."
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Opcional. Se preenchido, o participante só poderá concluir a inscrição após marcar a caixa de aceite.
              </p>
              <p className="text-xs text-muted-foreground">
                Ao atingir o limite de respostas ou o prazo, o formulário deixa de aceitar novas
                inscrições automaticamente.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Diálogo de confirmação para Excluir Pergunta */}
      <AlertDialog
        open={Boolean(questionToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingQuestion) {
            setQuestionToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta pergunta?</AlertDialogTitle>
            <AlertDialogDescription>
              As respostas já enviadas a ela deixam de aparecer na tabela e nas exportações. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingQuestion}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingQuestion}
              onClick={confirmRemoveQuestion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingQuestion ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
