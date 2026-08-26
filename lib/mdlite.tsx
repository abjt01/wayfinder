import type { ReactNode } from "react";

/**
 * Minimal inline formatter for assistant output: **bold**, `code`, bullet and
 * numbered lists, and blank-line paragraphs. Deliberately not a full markdown
 * parser — it only needs to make streamed model prose readable.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      out.push(
        <strong key={`${keyBase}-b${i++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      out.push(
        <code
          key={`${keyBase}-c${i++}`}
          className="rounded bg-paper px-1 py-0.5 font-mono text-[0.85em] text-ink-soft"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MdLite({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (!para.length) return;
    const content = para.join(" ");
    blocks.push(
      <p key={`p${key++}`} className="text-[13.5px] leading-relaxed text-ink-soft">
        {inline(content, `p${key}`)}
      </p>
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`l${key++}`}
        className={
          "space-y-1 pl-4 text-[13.5px] leading-relaxed text-ink-soft " +
          (list.ordered ? "list-decimal" : "list-disc")
        }
      >
        {list.items.map((it, i) => (
          <li key={i} className="marker:text-ink-faint">
            {inline(it, `l${key}-${i}`)}
          </li>
        ))}
      </Tag>
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      const item = (bullet?.[1] ?? numbered?.[1] ?? "").trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
      continue;
    }
    if (!line.trim()) {
      flushList();
      flushPara();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushList();
  flushPara();

  return <div className="space-y-2">{blocks}</div>;
}
