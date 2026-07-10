import React from 'react';

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
  if (!content) return null;

  // Pre-process: group lines and identify blocks (paragraphs, lists, tables, headings)
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  
  let currentList: React.ReactNode[] = [];
  let currentTableRows: string[][] = [];
  let isInsideTable = false;

  const flushList = (key: string | number) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="my-2.5 space-y-1.5 pl-1.5">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  const flushTable = (key: string | number) => {
    if (currentTableRows.length > 0) {
      // The second row is usually the alignment separator (e.g. |---|---|)
      const hasSeparator = currentTableRows.length > 1 && currentTableRows[1].every(cell => cell.trim().startsWith('-') || cell.trim() === '');
      const dataRows = hasSeparator ? currentTableRows.filter((_, idx) => idx !== 1) : currentTableRows;
      
      if (dataRows.length > 0) {
        const headers = dataRows[0];
        const rows = dataRows.slice(1);

        elements.push(
          <div key={`table-container-${key}`} className="overflow-x-auto my-4 rounded-2xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-sm shadow-2xl">
            <table className="w-full text-left border-collapse text-[11px] font-sans">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  {headers.map((header, hIdx) => (
                    <th key={hIdx} className="px-4 py-2.5 font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                      {parseInlineStyles(header.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="even:bg-slate-900/10 odd:bg-slate-950/15 hover:bg-indigo-500/5 transition-colors duration-150">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className={`px-4 py-2.5 ${cIdx === 0 ? 'font-semibold text-slate-100' : 'text-slate-350'}`}>
                        {parseInlineStyles(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      currentTableRows = [];
      isInsideTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Table Handling ──
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList(i);
      isInsideTable = true;
      const cells = trimmed.split('|').slice(1, -1);
      currentTableRows.push(cells);
      continue;
    } else if (isInsideTable) {
      flushTable(i);
    }

    // ── Blockquotes / Alerts ──
    if (trimmed.startsWith('> ')) {
      flushList(i);
      flushTable(i);
      const quoteContent = trimmed.substring(2);
      elements.push(
        <blockquote key={`quote-${i}`} className="my-3 pl-4 border-l-4 border-indigo-500 bg-indigo-950/20 py-2 px-3.5 rounded-r-2xl text-slate-300 text-xs italic shadow-md">
          {parseInlineStyles(quoteContent)}
        </blockquote>
      );
      continue;
    }

    // ── List Handling ──
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listContent = trimmed.substring(2);
      currentList.push(
        <li key={`li-${i}`} className="text-slate-350 leading-relaxed my-0.5 relative pl-4 text-xs">
          <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
          {parseInlineStyles(listContent)}
        </li>
      );
      continue;
    } else {
      flushList(i);
    }

    // ── Empty Lines ──
    if (trimmed === '') {
      elements.push(<div key={`space-${i}`} className="h-2" />);
      continue;
    }

    // ── Headings ──
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="text-[11px] font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent uppercase tracking-wider mt-4 mb-2 pb-1 border-b border-slate-800/40">
          {parseInlineStyles(trimmed.substring(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} className="text-sm font-extrabold text-slate-100 bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent mt-5 mb-2.5">
          {parseInlineStyles(trimmed.substring(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${i}`} className="text-base font-black text-slate-50 bg-gradient-to-r from-white via-indigo-100 to-purple-100 bg-clip-text text-transparent mt-6 mb-3">
          {parseInlineStyles(trimmed.substring(2))}
        </h2>
      );
      continue;
    }

    // ── Default Paragraph ──
    elements.push(
      <p key={`p-${i}`} className="text-slate-300 leading-relaxed my-1.5 text-xs">
        {parseInlineStyles(line)}
      </p>
    );
  }

  // Flush any remaining list or table
  flushList('end');
  flushTable('end');

  return <div className="space-y-0.5">{elements}</div>;
}

function parseInlineStyles(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-350 font-bold px-1.5 py-0.5 rounded text-[11px] shadow-sm select-all">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/50 text-indigo-400 font-mono text-[11px] font-medium">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
