import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { FIELD_TYPES, type FieldType } from "@/lib/validators";
import { normalizeOptions } from "@/lib/options";

export const inputClass =
  "w-full rounded-lg bg-white/80 px-3 py-2 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function QuestionOptionsField({
  options,
  onChange,
  idPrefix = "",
}: {
  options: string[];
  onChange: (options: string[]) => void;
  idPrefix?: string;
}) {
  const [text, setText] = useState(() => options.join("\n"));

  const textareaId = `${idPrefix}question-options`;

  return (
    <Field label="Opções (uma por linha)" htmlFor={textareaId}>
      <textarea
        id={textareaId}
        rows={5}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(normalizeOptions(raw));
        }}
        onBlur={() => {
          const normalized = normalizeOptions(text);
          setText(normalized.join("\n"));
          onChange(normalized);
        }}
        className={inputClass}
        placeholder={"Opção A\nOpção B"}
      />
    </Field>
  );
}

export interface EditableQuestion {
  id: string;
  label: string;
  help_text: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
  position?: number;
  settings?: Record<string, unknown> | null;
}

export interface QuestionEditFieldsProps {
  question: EditableQuestion;
  onChange: (patch: Partial<EditableQuestion>) => void;
  idPrefix: string;
  autoFocusLabel?: boolean;
  labelInputRef?: Ref<HTMLInputElement>;
}

export function QuestionEditFields({
  question,
  onChange,
  idPrefix,
  autoFocusLabel = false,
  labelInputRef,
}: QuestionEditFieldsProps) {
  const internalLabelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocusLabel && internalLabelRef.current) {
      internalLabelRef.current.focus();
      internalLabelRef.current.select();
    }
  }, [autoFocusLabel]);

  const setLabelRef = (node: HTMLInputElement | null) => {
    internalLabelRef.current = node;
    if (typeof labelInputRef === "function") {
      labelInputRef(node);
    } else if (labelInputRef && "current" in labelInputRef) {
      (labelInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
    }
  };

  const labelId = `${idPrefix}question-label-${question.id}`;
  const helpTextId = `${idPrefix}question-help-text-${question.id}`;
  const fieldTypeId = `${idPrefix}question-field-type-${question.id}`;
  const requiredId = `${idPrefix}question-required-${question.id}`;
  const minAgeId = `${idPrefix}question-min-age-${question.id}`;
  const maxAgeId = `${idPrefix}question-max-age-${question.id}`;

  const currentSettings =
    question.settings && typeof question.settings === "object" ? question.settings : {};
  const rawMinAge = currentSettings["minAge"];
  const rawMaxAge = currentSettings["maxAge"];
  const minAgeVal =
    rawMinAge !== null && rawMinAge !== undefined && rawMinAge !== ""
      ? Number(rawMinAge)
      : null;
  const maxAgeVal =
    rawMaxAge !== null && rawMaxAge !== undefined && rawMaxAge !== ""
      ? Number(rawMaxAge)
      : null;
  const isInvalidAgeOrder =
    minAgeVal !== null && maxAgeVal !== null && minAgeVal > maxAgeVal;

  return (
    <div className="space-y-4">
      <Field label="Rótulo da pergunta" htmlFor={labelId}>
        <input
          id={labelId}
          ref={setLabelRef}
          value={question.label}
          onChange={(e) => onChange({ label: e.target.value })}
          maxLength={200}
          className={inputClass}
        />
      </Field>

      <Field label="Texto de ajuda" htmlFor={helpTextId}>
        <input
          id={helpTextId}
          value={question.help_text}
          onChange={(e) => onChange({ help_text: e.target.value })}
          maxLength={200}
          className={inputClass}
          placeholder="Opcional"
        />
      </Field>

      <Field label="Tipo de campo" htmlFor={fieldTypeId}>
        <select
          id={fieldTypeId}
          value={question.field_type}
          onChange={(e) => {
            const nextType = e.target.value as FieldType;
            onChange({
              field_type: nextType,
              settings: {},
            });
          }}
          className={inputClass}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <label htmlFor={requiredId} className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          id={requiredId}
          type="checkbox"
          checked={question.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="size-4 accent-[var(--brand)]"
        />
        Resposta obrigatória
      </label>

      {question.field_type === "birthdate" && (
        <div className="space-y-3 rounded-xl bg-slate-50/80 p-3 ring-1 ring-black/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Idade mínima" htmlFor={minAgeId}>
              <input
                id={minAgeId}
                type="number"
                min={0}
                max={120}
                value={minAgeVal ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : Math.max(0, Math.min(120, Number(e.target.value)));
                  onChange({
                    settings: {
                      ...currentSettings,
                      minAge: val,
                    },
                  });
                }}
                placeholder="Sem limite"
                className={inputClass}
              />
            </Field>

            <Field label="Idade máxima" htmlFor={maxAgeId}>
              <input
                id={maxAgeId}
                type="number"
                min={0}
                max={120}
                value={maxAgeVal ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : Math.max(0, Math.min(120, Number(e.target.value)));
                  onChange({
                    settings: {
                      ...currentSettings,
                      maxAge: val,
                    },
                  });
                }}
                placeholder="Sem limite"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onChange({
                  settings: {
                    ...currentSettings,
                    minAge: 18,
                    maxAge: null,
                  },
                })
              }
              className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-black/10 hover:bg-slate-100 cursor-pointer"
            >
              Só maiores de 18
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  settings: {
                    ...currentSettings,
                    minAge: null,
                    maxAge: 17,
                  },
                })
              }
              className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-black/10 hover:bg-slate-100 cursor-pointer"
            >
              Só menores de 18
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  settings: {
                    ...currentSettings,
                    minAge: null,
                    maxAge: null,
                  },
                })
              }
              className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-black/10 hover:bg-slate-100 cursor-pointer"
            >
              Sem limite
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            A idade é contada na data do evento, se o formulário tiver uma, ou na data da inscrição.
          </p>

          {isInvalidAgeOrder && (
            <p className="text-xs font-medium text-destructive">
              A idade mínima não pode ser maior que a máxima.
            </p>
          )}
        </div>
      )}

      {(question.field_type === "single_choice" || question.field_type === "multi_choice") && (
        <QuestionOptionsField
          key={question.id}
          options={question.options}
          onChange={(options) => onChange({ options })}
          idPrefix={idPrefix}
        />
      )}
    </div>
  );
}
