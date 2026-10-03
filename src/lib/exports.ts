import { formatAnswer } from "./answer-format";
import { slug } from "./slug";

export type ExportQuestion = { id: string; label: string; field_type?: string };
export type ExportResponse = {
  submitted_at: string;
  answers: Record<string, string | string[]>;
};

const fmtDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function buildRows(questions: ExportQuestion[], responses: ExportResponse[]) {
  const header = ["Enviado em", ...questions.map((q) => q.label)];
  const rows = responses.map((r) => [
    fmtDate(r.submitted_at),
    ...questions.map((q) => {
      const v = r.answers?.[q.id];
      return formatAnswer(q.field_type, v);
    }),
  ]);
  return { header, rows };
}

export async function exportToExcel(
  formTitle: string,
  questions: ExportQuestion[],
  responses: ExportResponse[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const { header, rows } = buildRows(questions, responses);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = header.map(() => ({ wch: 26 }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Respostas");
  XLSX.writeFile(book, `${slug(formTitle)}-respostas.xlsx`);
}

export async function buildPdfDocument(
  formTitle: string,
  questions: ExportQuestion[],
  responses: ExportResponse[],
): Promise<any> {
  const [jsPdfModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDF = jsPdfModule.default ?? jsPdfModule;
  const autoTable = autoTableModule.default ?? autoTableModule;

  const { header, rows } = buildRows(questions, responses);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(formTitle, 40, 40);
  doc.setFontSize(10);
  doc.text(
    `${responses.length} resposta(s) · gerado em ${new Date().toLocaleString("pt-BR")}`,
    40,
    58,
  );
  autoTable(doc, {
    head: [header],
    body: rows,
    startY: 74,
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 246, 251] },
    margin: { left: 40, right: 40 },
  });
  return doc;
}

export async function exportToPDF(
  formTitle: string,
  questions: ExportQuestion[],
  responses: ExportResponse[],
): Promise<void> {
  const doc = await buildPdfDocument(formTitle, questions, responses);
  doc.save(`${slug(formTitle)}-respostas.pdf`);
}

export async function printPdf(
  formTitle: string,
  questions: ExportQuestion[],
  responses: ExportResponse[],
): Promise<void> {
  let win: Window | null = null;
  try {
    if (typeof window !== "undefined" && typeof window.open === "function") {
      win = window.open("", "_blank");
    }
  } catch {
    win = null;
  }

  let doc: any = null;
  try {
    doc = await buildPdfDocument(formTitle, questions, responses);
    if (!win || win.closed) {
      doc.save(`${slug(formTitle)}-respostas.pdf`);
      return;
    }

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignora erro ao revogar
      }
    }, 60_000);
  } catch (err) {
    if (win && !win.closed) {
      try {
        win.close();
      } catch {
        // ignora erro ao fechar
      }
    }
    if (!doc) {
      doc = await buildPdfDocument(formTitle, questions, responses);
    }
    doc.save(`${slug(formTitle)}-respostas.pdf`);
  }
}
