import { describe, expect, it } from 'vitest';
import { renderStoryMarkdown, storySectionIdFromFileName } from './story-script.util';

describe('story script utilities', () => {
  it('derives stable database-safe section ids from image names', () => {
    expect(storySectionIdFromFileName('1.png')).toBe('1');
    expect(storySectionIdFromFileName('1')).toBe('1');
    expect(storySectionIdFromFileName(' act.1/intro.webp ')).toBe('act_1_intro');
    expect(storySectionIdFromFileName('.png')).toBe('_png');
    expect(storySectionIdFromFileName('')).toBe('slide');
  });

  it('renders the supported Markdown while escaping raw HTML', () => {
    const html = renderStoryMarkdown(
      '# Таверна\n\n> — Кто идёт?\n\n**Проверка СЛ 12** <script>alert(1)</script>\n\n- Гоблин\n- Ключ',
    );

    expect(html).toContain('<h1>Таверна</h1>');
    expect(html).toContain('<blockquote>— Кто идёт?</blockquote>');
    expect(html).toContain('<strong>Проверка СЛ 12</strong>');
    expect(html).toContain('<ul><li>Гоблин</li><li>Ключ</li></ul>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
