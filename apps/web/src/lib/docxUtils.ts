import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import mammoth from 'mammoth';

/**
 * Converts HTML string to clean paragraphs/elements for DOCX export.
 */
export async function exportDocxFile(title: string, htmlContent: string, plainText: string): Promise<Blob> {
  // Create a clean DOM parser to extract structural elements
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent || `<p>${plainText}</p>`, 'text/html');

  const children: any[] = [];

  // Add Document Title
  children.push(
    new Paragraph({
      text: title || 'Writing Studio Document',
      heading: HeadingLevel.TITLE,
      spacing: { after: 300 },
    })
  );

  const processNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'h1') {
        children.push(
          new Paragraph({
            text: el.textContent || '',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (tag === 'h2') {
        children.push(
          new Paragraph({
            text: el.textContent || '',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (tag === 'h3') {
        children.push(
          new Paragraph({
            text: el.textContent || '',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
          })
        );
      } else if (tag === 'table') {
        const rows: TableRow[] = [];
        const trEls = el.querySelectorAll('tr');
        trEls.forEach((tr) => {
          const cells: TableCell[] = [];
          tr.querySelectorAll('th, td').forEach((cell) => {
            cells.push(
              new TableCell({
                width: { size: 3000, type: WidthType.DXA },
                children: [new Paragraph({ text: cell.textContent || '' })],
              })
            );
          });
          if (cells.length > 0) {
            rows.push(new TableRow({ children: cells }));
          }
        });
        if (rows.length > 0) {
          children.push(
            new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          );
        }
      } else if (tag === 'ul' || tag === 'ol') {
        el.querySelectorAll('li').forEach((li) => {
          children.push(
            new Paragraph({
              text: `• ${li.textContent || ''}`,
              spacing: { after: 80 },
            })
          );
        });
      } else if (tag === 'p') {
        const text = el.textContent || '';
        if (text.trim().length > 0) {
          children.push(
            new Paragraph({
              children: [new TextRun(text)],
              spacing: { after: 120 },
            })
          );
        }
      } else {
        el.childNodes.forEach(processNode);
      }
    }
  };

  doc.body.childNodes.forEach(processNode);

  if (children.length === 1 && plainText) {
    const lines = plainText.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        children.push(new Paragraph({ text: line, spacing: { after: 120 } }));
      }
    }
  }

  const docxDoc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(docxDoc);
}

/**
 * Imports a DOCX file using Mammoth and returns clean semantic HTML.
 */
export async function importDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

/**
 * Downloads a Blob as a file in the browser.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
