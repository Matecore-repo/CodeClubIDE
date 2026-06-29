import React from "react";

function renderTableRow(row: string, i: number, isHeader: boolean): React.ReactNode {
  const cells = row
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  if (i === 1 && /^[\s:-]+$/.test(cells.join(""))) return null;
  const Tag = (isHeader ? "th" : "td") as "th" | "td";
  const textColor = isHeader ? "var(--text-strong)" : "var(--text-base)";
  const fontWeight = isHeader ? 600 : 400;
  return (
    <tr key={i}>
      {cells.map((c, j) => (
        <Tag
          key={j}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--border-weaker-base)",
            fontSize: "var(--font-size-small)",
            color: textColor,
            fontWeight,
            textAlign: "left" as const,
          }}
        >
          {...renderInline(c, `cell-${i}-${j}`)}
        </Tag>
      ))}
    </tr>
  );
}

function renderInline(text: string, lineKey: string | number = "inline"): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const combinedRegex = /(`[^`]+`)|(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(.+?)\*)|(_(.+?)_)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const elementKey = `${lineKey}-${match.index}`;
    if (match[1] !== undefined) {
      parts.push(
        <code
          key={elementKey}
          style={{
            background: "var(--surface-inset-base)",
            padding: "1px 4px",
            borderRadius: "var(--radius-xs)",
            fontFamily: "var(--font-family-mono)",
            fontSize: "0.9em",
          }}
        >
          {match[1].slice(1, -1)}
        </code>,
      );
    } else if (match[2] !== undefined) {
      parts.push(<strong key={elementKey}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      parts.push(<strong key={elementKey}>{match[5]}</strong>);
    } else if (match[6] !== undefined) {
      parts.push(<em key={elementKey}>{match[7]}</em>);
    } else if (match[8] !== undefined) {
      parts.push(<em key={elementKey}>{match[9]}</em>);
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

function renderContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const lines = text.split("\n");
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let tableRows: string[] = [];
  let inTable = false;
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        parts.push(
          <pre
            key={key++}
            style={{
              background: "var(--surface-inset-base)",
              padding: 16,
              borderRadius: "var(--radius-sm)",
              overflow: "auto",
              fontSize: "var(--font-size-small)",
              lineHeight: 1.6,
              fontFamily: "var(--font-family-mono)",
              margin: 0,
            }}
          >
            {codeLang && (
              <div style={{ fontSize: 11, color: "var(--text-weaker)", marginBottom: 8 }}>
                {codeLang}
              </div>
            )}
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        inCode = false;
        codeLines = [];
        codeLang = "";
      } else {
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = [
        "var(--font-size-x-large)",
        "var(--font-size-large)",
        "var(--font-size-base)",
        "var(--font-size-small)",
        "var(--font-size-small)",
        "var(--font-size-small)",
      ][level - 1];
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      parts.push(
        <Tag
          key={key++}
          style={{ fontSize, fontWeight: 600, color: "var(--text-strong)", margin: "8px 0 4px" }}
        >
          {...renderInline(headingMatch[2], `h-${key}`)}
        </Tag>,
      );
      continue;
    }

    if (/^(\s*[-*_]\s*){3,}\s*$/.test(line.trim())) {
      parts.push(
        <hr
          key={key++}
          style={{
            border: "none",
            borderTop: "1px solid var(--border-weaker-base)",
            margin: "8px 0",
          }}
        />,
      );
      continue;
    }

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (!inTable && i + 1 < lines.length && /^\|[\s:-]+\|/.test(lines[i + 1].trim())) {
        inTable = true;
        tableRows = [line];
      } else if (inTable) {
        tableRows.push(line);
        if (
          i + 1 >= lines.length ||
          !lines[i + 1].trim().startsWith("|") ||
          !lines[i + 1].trim().endsWith("|")
        ) {
          parts.push(
            <table
              key={key++}
              style={{
                borderCollapse: "collapse",
                margin: "6px 0",
                width: "100%",
                background: "var(--surface-inset-base)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <thead>{renderTableRow(tableRows[0], 0, true)}</thead>
              <tbody>{tableRows.slice(2).map((r, j) => renderTableRow(r, j + 2, false))}</tbody>
            </table>,
          );
          inTable = false;
          tableRows = [];
        }
      } else {
        parts.push(...renderInline(line, `l-${i}`));
        if (i < lines.length - 1) parts.push("\n");
      }
      continue;
    }

    if (inTable) {
      parts.push(
        <table
          key={key++}
          style={{
            borderCollapse: "collapse",
            margin: "6px 0",
            width: "100%",
            background: "var(--surface-inset-base)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <thead>{renderTableRow(tableRows[0], 0, true)}</thead>
          <tbody>{tableRows.slice(2).map((r, j) => renderTableRow(r, j + 2, false))}</tbody>
        </table>,
      );
      inTable = false;
      tableRows = [];
    }

    parts.push(...renderInline(line, `l-${i}`));
    if (i < lines.length - 1) parts.push("\n");
  }

  if (inCode) {
    parts.push(
      <pre
        key={key++}
        style={{
          background: "var(--surface-inset-base)",
          padding: 16,
          borderRadius: "var(--radius-sm)",
          overflow: "auto",
          fontSize: "var(--font-size-small)",
          lineHeight: 1.6,
          fontFamily: "var(--font-family-mono)",
          margin: 0,
        }}
      >
        {codeLang && (
          <div style={{ fontSize: 11, color: "var(--text-weaker)", marginBottom: 8 }}>
            {codeLang}
          </div>
        )}
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );
  }

  if (inTable) {
    parts.push(
      <table
        key={key++}
        style={{
          borderCollapse: "collapse",
          margin: "6px 0",
          width: "100%",
          background: "var(--surface-inset-base)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <thead>{renderTableRow(tableRows[0], 0, true)}</thead>
        <tbody>{tableRows.slice(2).map((r, j) => renderTableRow(r, j + 2, false))}</tbody>
      </table>,
    );
  }

  return parts;
}

function extractThinking(text: string): { thinking: string | null; mainContent: string } {
  const startTag = "<thinking>";
  const endTag = "</thinking>";

  const startIndex = text.indexOf(startTag);
  if (startIndex === -1) {
    return { thinking: null, mainContent: text };
  }

  const contentStartIndex = startIndex + startTag.length;
  const endIndex = text.indexOf(endTag, contentStartIndex);

  if (endIndex === -1) {
    const thinking = text.slice(contentStartIndex);
    const mainContent = text.slice(0, startIndex);
    return { thinking, mainContent };
  } else {
    const thinking = text.slice(contentStartIndex, endIndex);
    const mainContent = text.slice(0, startIndex) + text.slice(endIndex + endTag.length);
    return { thinking, mainContent };
  }
}

export { renderContent, extractThinking };
