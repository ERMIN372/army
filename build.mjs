// Сборка статического сайта: src/pages/*.html + src/partials/*.html → dist/
// Без зависимостей. Запуск: node build.mjs
//
// В начале каждой страницы — мета-комментарий:
//   <!-- {"title": "...", "description": "...", "nav": "vyplaty"} -->
// Вставка частей: {{> header}}, {{> footer}}, {{> apply}}
// Переменные: {{title}}, {{description}}, {{page}}

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, basename } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "dist");

const partials = Object.fromEntries(
  readdirSync(join(SRC, "partials"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => [basename(f, ".html"), readFileSync(join(SRC, "partials", f), "utf8")])
);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });

const META_RE = /^\s*<!--\s*(\{[\s\S]*?\})\s*-->\s*/;

for (const file of readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".html"))) {
  let body = readFileSync(join(SRC, "pages", file), "utf8");
  const m = body.match(META_RE);
  if (!m) throw new Error(`${file}: нет мета-комментария в начале файла`);
  const meta = JSON.parse(m[1]);
  body = body.slice(m[0].length);

  const vars = { ...meta, page: basename(file, ".html") };
  let html = partials.layout.replace("{{content}}", body);

  // Части могут содержать другие части — раскрываем до стабилизации
  for (let i = 0; i < 5 && html.includes("{{>"); i++) {
    html = html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`${file}: нет части ${name}`);
      return partials[name];
    });
  }
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ""));

  // Подсветка активного пункта меню
  html = html.replace(
    new RegExp(`(<a [^>]*data-nav="${meta.nav}")`, "g"),
    '$1 aria-current="page"'
  );

  writeFileSync(join(OUT, file), html);
  console.log("✓", file);
}
