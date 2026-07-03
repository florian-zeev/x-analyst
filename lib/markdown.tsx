import type { ReactNode } from "react";

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "blockquote"; text: string };

export function renderMarkdown(markdown: string) {
  return parseBlocks(markdown).map((block, index) => {
    switch (block.type) {
      case "heading": {
        const children = renderInline(block.text);
        if (block.level === 1) {
          return <h1 key={index}>{children}</h1>;
        }
        if (block.level === 2) {
          return <h2 key={index}>{children}</h2>;
        }
        return <h3 key={index}>{children}</h3>;
      }
      case "unordered-list":
        return (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </ul>
        );
      case "ordered-list":
        return (
          <ol key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      case "blockquote":
        return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
      case "paragraph":
        return <p key={index}>{renderInline(block.text)}</p>;
    }
  });
}

function parseBlocks(markdown: string) {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2]
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quotes: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quotes.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quotes.join(" ") });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      const nextLine = lines[index].trim();
      if (
        /^(#{1,3})\s+/.test(nextLine) ||
        /^[-*]\s+/.test(nextLine) ||
        /^\d+\.\s+/.test(nextLine) ||
        /^>\s?/.test(nextLine)
      ) {
        break;
      }
      paragraph.push(nextLine);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|(https?:\/\/[^\s)]+))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          href={match[3]}
          key={match.index}
          rel="noreferrer"
          target="_blank"
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      nodes.push(<code key={match.index}>{match[4]}</code>);
    } else if (match[5]) {
      nodes.push(<strong key={match.index}>{match[5]}</strong>);
    } else if (match[6]) {
      nodes.push(
        <a
          href={match[6]}
          key={match.index}
          rel="noreferrer"
          target="_blank"
        >
          {linkLabel(match[6])}
        </a>
      );
    }

    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function linkLabel(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "x.com" || host === "twitter.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const handle = parts[0] && parts[0] !== "i" ? `@${parts[0]}` : "X";
      return handle;
    }

    return host;
  } catch {
    return url;
  }
}
