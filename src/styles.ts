/**
 * Backup plugin stylesheet — injected once from `register()`.
 *
 * The panel used to be ~40 inline style objects that reached for two vars the
 * app never defines (`--radius-md`, `--text-primary`), so every card rendered
 * square and every "primary" label fell back to the inherited colour. Every
 * box/row/button rule now lives here and speaks only real tokens: 7px
 * (`--radius`) boxes, 5px (`--radius-sm`) chrome chips, the accent used once on
 * the single primary action. Inline styles survive only for live values (a
 * progress width).
 */
const STYLE_ID = 'notes-backup-styles'

export const CSS = `
@keyframes notes-backup-spin { to { transform: rotate(360deg) } }

.settings-section.backup-settings-list,
.settings-section.backup-settings-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-section.backup-settings-list { gap: 0; }
.backup-settings-folder {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0 14px;
  border-bottom: 1px solid var(--border-light);
}
.backup-settings-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.backup-settings-field { width: min(320px, 100%); }
.backup-settings-add { align-self: flex-start; }
.backup-settings-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}
.backup-settings-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  background: var(--hover-bg);
  color: var(--text-secondary);
}
.backup-settings-glyph svg { width: 16px; height: 16px; }
.backup-settings-glyph--large { width: 42px; height: 42px; }
.backup-settings-glyph--large svg { width: 20px; height: 20px; }
.backup-settings-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 2px 9px;
  border: 1px solid var(--border-medium);
  border-radius: 999px;
  background: var(--container-color-alt);
  color: var(--text-secondary);
  font-size:0.6875rem;
  white-space: nowrap;
}
.backup-settings-badge.is-configured {
  border-color: transparent;
  background: var(--accent-tint-bg);
  color: var(--accent-tint-text);
}
.backup-settings-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--negative-color);
}
.backup-settings-badge.is-configured .backup-settings-dot { background: var(--positive-color); }
.backup-settings-remove {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid var(--border-light);
}

.backup-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: var(--interface-font);
  color: var(--text-color);
}

/* ---- Header profile picker (sits beside the panel title) ---------------- */
/* .panel-header is a window drag region — every control in it needs no-drag. */
.backup-profile {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 62%;
  height: 26px;
  padding: 0 var(--space-1) 0 var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--smaller-font-size);
  font-weight: var(--font-medium);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.backup-profile:hover:not(:disabled) {
  background: var(--hover-bg);
  color: var(--title-color);
}
.backup-profile:disabled { cursor: default; opacity: 0.55; }
.backup-profile-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.backup-profile svg { width: 13px; height: 13px; flex: none; color: var(--text-tertiary); }

/* ---- Tab strip — 37px content + 1px line ------------------------------- */
.backup-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
  height: var(--app-bar-height);
  padding: 0 5px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--border-light);
}
.backup-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.backup-tab:hover { background: var(--hover-bg); color: var(--title-color); }
.backup-tab.active { background: var(--accent-tint-bg); color: var(--accent-tint-text); }
.backup-tab svg { width: 16px; height: 16px; }
.backup-tab--end { margin-left: auto; }

/* A run stays visible from every tab: a hairline of progress under the strip. */
.backup-runline {
  flex-shrink: 0;
  height: 2px;
  background: var(--container-color-light);
}
.backup-runline > i {
  display: block;
  height: 100%;
  background: var(--accent-color);
  transition: width var(--duration-base) var(--ease-out);
}

/* ---- Body -------------------------------------------------------------- */
.backup-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-4);
  overflow-x: hidden;
  overflow-y: auto;
}
/* A flex item's min-width defaults to auto: without this, one nowrap button sets
   the min-content width and the whole card spills past the panel edge. */
.backup-body > * { min-width: 0; }
/* The log tab fills instead of scrolling — the <pre> owns the scrollbar. */
.backup-body--fill { overflow: hidden; }

/* ---- Primary action ---------------------------------------------------- */
.backup-run {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius);
  background: var(--accent-color);
  color: #fff;
  font-family: inherit;
  font-size: var(--small-font-size);
  font-weight: var(--font-semi-bold);
  cursor: pointer;
  transition: filter var(--duration-fast) var(--ease-out);
}
.backup-run:hover:not(:disabled) { filter: brightness(1.08); }
.backup-run:disabled { opacity: 0.6; cursor: default; }
.backup-run svg { width: 15px; height: 15px; }

/* ---- Secondary buttons -------------------------------------------------- */
.backup-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: 5px var(--space-3);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius);
  background: var(--container-color);
  color: var(--text-color);
  font-family: inherit;
  font-size: var(--smaller-font-size);
  font-weight: var(--font-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}
.backup-btn:hover:not(:disabled) { background: var(--hover-bg); color: var(--title-color); }
.backup-btn:disabled { opacity: 0.45; cursor: default; }
.backup-btn--accent {
  border-color: transparent;
  background: var(--accent-tint-bg);
  color: var(--accent-tint-text);
}
.backup-btn--accent:hover:not(:disabled) { background: var(--accent-tint-bg); filter: brightness(1.1); }
.backup-btn--quiet {
  border-color: transparent;
  background: transparent;
  color: var(--text-secondary);
}
.backup-btn--wide { flex: 1 1 auto; }

/* ---- Progress ----------------------------------------------------------- */
.backup-progress { display: flex; flex-direction: column; gap: var(--space-1); }
.backup-track {
  height: 6px;
  width: 100%;
  border-radius: var(--radius);
  background: var(--container-color-light);
  overflow: hidden;
}
.backup-track > i {
  display: block;
  height: 100%;
  border-radius: var(--radius);
  background: var(--accent-color);
  transition: width var(--duration-base) var(--ease-out);
}
.backup-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--smaller-font-size);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* ---- Status line -------------------------------------------------------- */
.backup-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-size: var(--small-font-size);
  color: var(--text-secondary);
}
.backup-status.is-done { color: var(--positive-color); }
.backup-status.is-failed { color: var(--negative-color); }
.backup-status span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.backup-status svg { width: 14px; height: 14px; flex: none; }

/* ---- Section heads ------------------------------------------------------ */
.backup-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 24px;
}
.backup-section-title {
  font-size: var(--smaller-font-size);
  font-weight: var(--font-semi-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

/* ---- Flat hairline rows (folders, history, archives) -------------------- */
.backup-rows { display: flex; flex-direction: column; min-width: 0; }
.backup-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-2) 0;
  border-top: 1px solid var(--border-light);
}
.backup-rows > .backup-row:first-child { border-top: none; padding-top: 0; }
.backup-row-icon { display: flex; flex: none; color: var(--text-tertiary); }
.backup-row-icon svg { width: 14px; height: 14px; }
.backup-row-icon.is-ok { color: var(--positive-color); }
.backup-row-icon.is-bad { color: var(--negative-color); }
.backup-row-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 auto; }
.backup-row-label {
  font-size: var(--small-font-size);
  color: var(--title-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.backup-row-sub {
  font-size: var(--smaller-font-size);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Shrinkable on purpose: with flex:none a long value squeezed
   .backup-row-main to zero width and the folder name vanished. */
.backup-row-meta {
  flex: 0 1 auto;
  font-size: var(--smaller-font-size);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.backup-row-actions { display: flex; align-items: center; gap: var(--space-1); flex: none; }

/* ---- Alert (pre-flight issues) ------------------------------------------ */
/* The sidebar is 245px at its narrowest: the card must shrink (min-width:0) and
   its buttons wrap instead of pushing the card past the panel edge. */
.backup-alert {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--tint-red-bg);
}
.backup-alert-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-size: var(--small-font-size);
  font-weight: var(--font-semi-bold);
  color: var(--tint-red-text);
}
.backup-alert-title svg { width: 15px; height: 15px; flex: none; }
.backup-alert-msg {
  font-size: var(--smaller-font-size);
  color: var(--text-color);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.backup-alert-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.backup-alert-actions > .backup-btn { flex: 1 1 auto; min-width: 0; }

/* ---- Inline confirm cards (prune / restore) ----------------------------- */
.backup-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--container-color-light);
}
.backup-card-text {
  font-size: var(--smaller-font-size);
  color: var(--title-color);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.backup-card-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.backup-card-actions > .backup-btn { flex: 1 1 auto; min-width: 0; }
.backup-note { font-size: var(--smaller-font-size); color: var(--text-tertiary); line-height: 1.45; }

/* ---- Empty states -------------------------------------------------------- */
.backup-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-3);
  text-align: center;
  font-size: var(--smaller-font-size);
  color: var(--text-tertiary);
  line-height: 1.5;
}

/* ---- Raw mirror log ------------------------------------------------------- */
.backup-log {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: var(--space-2);
  border-radius: var(--radius);
  background: var(--surface-color-alt);
  color: var(--text-secondary);
  font-family: var(--mono-font);
  font-size: var(--smaller-font-size);
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
}
`

/** Inject (or refresh, on hot reload) the plugin stylesheet. */
export function injectStyles(): () => void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = CSS
  return () => {
    if (document.getElementById(STYLE_ID) === el) el.remove()
  }
}
