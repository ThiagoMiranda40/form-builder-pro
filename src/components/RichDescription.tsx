import React from "react";
import {
  parseRichDescription,
  type Inline,
  type ParagraphBlock,
  type ListBlock,
  type RichBlock,
} from "@/lib/rich-description";

export interface RichDescriptionProps {
  text: string | null | undefined;
  className?: string;
}

function renderInline(inline: Inline, key: string | number) {
  let content: React.ReactNode = inline.text;

  if (inline.bold && inline.italic) {
    content = (
      <strong>
        <em>{content}</em>
      </strong>
    );
  } else if (inline.bold) {
    content = <strong>{content}</strong>;
  } else if (inline.italic) {
    content = <em>{content}</em>;
  }

  if (inline.href) {
    return (
      <a
        key={key}
        href={inline.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    );
  }

  return <React.Fragment key={key}>{content}</React.Fragment>;
}

function renderLine(line: Inline[], lineIndex: number, totalLines: number) {
  return (
    <React.Fragment key={lineIndex}>
      {line.map((inline, i) => renderInline(inline, i))}
      {lineIndex < totalLines - 1 && <br />}
    </React.Fragment>
  );
}

export function RichDescription({ text, className = "" }: RichDescriptionProps) {
  const blocks = parseRichDescription(text);
  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-3 leading-relaxed break-words ${className}`.trim()}>
      {blocks.map((block, blockIndex) => {
        if (block.kind === "list") {
          return (
            <ul
              key={blockIndex}
              className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300"
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {item.map((inline, i) => renderInline(inline, i))}
                </li>
              ))}
            </ul>
          );
        }

        const isCenter = block.align === "center";
        return (
          <p
            key={blockIndex}
            className={`text-slate-700 dark:text-slate-300 ${
              isCenter ? "text-center" : "text-left"
            }`}
          >
            {block.lines.map((line, lineIndex) =>
              renderLine(line, lineIndex, block.lines.length)
            )}
          </p>
        );
      })}
    </div>
  );
}
