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

  useEffect(() => {
    setText(options.join("\n"));
  }, [options]);

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
          onChange={(e) => onChange({ field_type: e.target.value as FieldType })}
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
