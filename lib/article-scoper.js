/**
 * CSS scoper for KB article HTML.
 *
 * Some articles embed a standalone page template whose <style> block uses
 * GLOBAL selectors (*, body, table, header…). CSS is global, so those rules
 * leak out of the article body and restyle the whole portal page while the
 * article is on screen. Instead of stripping the design, SCOPE it: wrap the
 * article in a marker div and prefix every CSS selector so rules only apply
 * inside that wrapper. body/html selectors map to the wrapper itself. The
 * template markup — and therefore the authored design — is kept untouched.
 *
 * Used by deploy/14-nexgen-import-dev.js (dev import) and
 * deploy/17-fix-prod-articles.js (prod in-place fix).
 * Idempotent: already-scoped text is returned unchanged.
 */
const TPL_SCOPE = 'ahc-embedded-tpl';

function scopeCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip comments so selectors parse cleanly
    .replace(/([^{}]+)\{/g, (match, selectors) => {
      const scoped = selectors.split(',').map(sel => {
        const s = sel.trim();
        if (!s) return s;
        if (s.startsWith('@')) return s;                       // @media/@keyframes prelude
        if (/^(\d+%|from|to)$/i.test(s)) return s;             // keyframe steps
        if (/^(body|html)$/i.test(s)) return `.${TPL_SCOPE}`;  // page root → wrapper
        const deBodied = s.replace(/^(body|html)\s+/i, '');    // "body .x" → ".x"
        return `.${TPL_SCOPE} ${deBodied}`;
      }).join(', ');
      return scoped + '{';
    });
}

function sanitizeArticleHtml(html) {
  let out = (html || '')
    // HubSpot export wraps content with a sidebar allowance that squeezes the layout
    .replace(/(<div style=")margin-right: 400px;\s*(")/gi, '$1$2');

  if (!/<style>/i.test(out)) return out;
  // Already scoped (by a previous run or the dev import) — don't double-wrap
  if (out.includes(`class="${TPL_SCOPE}"`)) return out;

  out = out.replace(/<style>([\s\S]*?)<\/style>/gi, (m, css) => `<style>${scopeCss(css)}</style>`);
  return `<div class="${TPL_SCOPE}">${out}</div>`;
}

module.exports = { sanitizeArticleHtml, scopeCss, TPL_SCOPE };
