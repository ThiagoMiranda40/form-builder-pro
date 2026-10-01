import React from "react";
import { applyMask } from "@/lib/validators";

export const fieldClass =
  "w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none";

const placeholders: Record<string, string> = {
  cpf: "000.000.000-00",
  phone: "(11) 99999-9999",
  rg: "00.000.000-0",
  email: "voce@exemplo.com",
};

export interface QuestionData {
  id: string;
  label: string;
  help_text?: string | null;
  field_type: string;
  required: boolean;
  options?: string[];
  position?: number;
}

export interface QuestionFieldProps {
  question: QuestionData;
  value?: string | string[] | undefined;
  error?: string | undefined;
  accent?: string | undefined;
  readOnly?: boolean | undefined;
  readOnlyNotice?: string | undefined;
  onChange?: ((val: string | string[]) => void) | undefined;
}

export function QuestionField({
  question,
  value,
  error,
  accent = "#4f46e5",
  readOnly = false,
  readOnlyNotice,
  onChange,
}: QuestionFieldProps) {
  const type = question.field_type;
  const fieldId = `field-${question.id}`;
  const errorId = `error-${question.id}`;
  const labelId = `label-${question.id}`;
  const noticeId = `notice-${question.id}`;
  const isChoice = type === "single_choice" || type === "multi_choice";

  const readOnlyDescribedBy =
    [error ? errorId : undefined, readOnly && readOnlyNotice ? noticeId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  const handleChange = (newVal: string) => {
    if (readOnly) return;
    const masked = applyMask(type, newVal);
    onChange?.(masked);
  };

  const handleToggleMulti = (option: string) => {
    if (readOnly) return;
    const current = Array.isArray(value) ? value : [];
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    onChange?.(next);
  };

  return (
    <div>
      {isChoice ? (
        <span id={labelId} className="mb-1.5 block text-sm font-medium">
          {question.label}
          {question.required && (
            <span className="ml-1" style={{ color: accent }}>
              *
            </span>
          )}
        </span>
      ) : (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium">
          {question.label}
          {question.required && (
            <span className="ml-1" style={{ color: accent }}>
              *
            </span>
          )}
        </label>
      )}

      {question.help_text && (
        <p className="mb-1.5 text-xs text-muted-foreground">{question.help_text}</p>
      )}

      {readOnly ? (
        <div>
          <div className="relative">
            <input
              id={fieldId}
              readOnly
              value={(value as string) ?? ""}
              className={`${fieldClass} bg-black/[0.03] cursor-not-allowed pr-9`}
              aria-invalid={Boolean(error)}
              aria-describedby={readOnlyDescribedBy}
            />
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm select-none"
              aria-hidden="true"
            >
              🔒
            </span>
          </div>
          {readOnlyNotice && (
            <p id={noticeId} className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
              <span aria-hidden="true">ℹ</span> {readOnlyNotice}
            </p>
          )}
        </div>
      ) : type === "long_text" ? (
        <textarea
          id={fieldId}
          rows={4}
          value={(value as string) ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={2000}
          className={fieldClass}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      ) : type === "single_choice" ? (
        <div
          className="space-y-2"
          role="radiogroup"
          aria-labelledby={labelId}
          aria-describedby={error ? errorId : undefined}
        >
          {(question.options ?? []).map((option, optIdx) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2.5 text-sm ring-1 ring-black/5"
            >
              <input
                id={optIdx === 0 ? fieldId : undefined}
                type="radio"
                name={question.id}
                checked={value === option}
                onChange={() => onChange?.(option)}
                className="size-4"
                style={{ accentColor: accent }}
                aria-invalid={Boolean(error)}
              />
              {option}
            </label>
          ))}
        </div>
      ) : type === "multi_choice" ? (
        <div
          className="space-y-2"
          role="group"
          aria-labelledby={labelId}
          aria-describedby={error ? errorId : undefined}
        >
          {(question.options ?? []).map((option, optIdx) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2.5 text-sm ring-1 ring-black/5"
            >
              <input
                id={optIdx === 0 ? fieldId : undefined}
                type="checkbox"
                checked={Array.isArray(value) && value.includes(option)}
                onChange={() => handleToggleMulti(option)}
                className="size-4"
                style={{ accentColor: accent }}
                aria-invalid={Boolean(error)}
              />
              {option}
            </label>
          ))}
        </div>
      ) : (
        <input
          id={fieldId}
          type={type === "date" ? "date" : type === "number" ? "number" : "text"}
          inputMode={
            type === "number" || type === "phone" || type === "cpf" ? "numeric" : undefined
          }
          value={(value as string) ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={255}
          placeholder={placeholders[type]}
          className={fieldClass}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
