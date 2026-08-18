const FIREBASE_FORBIDDEN_KEY_CHARACTERS = /[\u0000-\u001f\u007f.#$[\]/]/g;

export function storySectionIdFromFileName(fileName: string): string {
  const normalizedName = fileName.trim().normalize('NFKC');
  const extensionIndex = normalizedName.lastIndexOf('.');
  const nameWithoutExtension = extensionIndex > 0
    ? normalizedName.slice(0, extensionIndex)
    : normalizedName;

  return nameWithoutExtension.replace(FIREBASE_FORBIDDEN_KEY_CHARACTERS, '_').trim() || 'slide';
}

export function renderStoryMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(renderInline(lines[index].replace(/^>\s?/, '')));
        index += 1;
      }
      blocks.push(`<blockquote>${quoteLines.join('<br>')}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\d+[.)]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      blocks.push('<hr>');
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index], paragraph.length)) {
      paragraph.push(renderInline(lines[index]));
      index += 1;
    }
    blocks.push(`<p>${paragraph.join('<br>')}</p>`);
  }

  return blocks.join('');
}

function isBlockStart(line: string, paragraphLength: number): boolean {
  if (paragraphLength === 0) return false;
  return /^(#{1,3})\s+|^>\s?|^[-*]\s+|^\d+[.)]\s+|^\s*---+\s*$/.test(line);
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
