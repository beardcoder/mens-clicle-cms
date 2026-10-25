import css from './site.css' with { type: 'text' }

/** Site stylesheet is embedded at build time and served with a content hash for immutable caching */
export const CSS = css
export const CSS_HASH = Bun.hash(css).toString(36)
export const CSS_URL = `/assets/site.${CSS_HASH}.css`
