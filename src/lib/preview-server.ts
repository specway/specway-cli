import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { watch } from 'chokidar';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

interface PreviewOptions {
  port: number;
  open: boolean;
  specPath: string;
}

function loadSpecJson(specPath: string): string {
  const content = readFileSync(specPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = parseYaml(content);
  }
  return JSON.stringify(parsed);
}

function buildHtml(specJson: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Specway Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #ffffff;
      --bg-subtle: #f8fafc;
      --bg-muted: #f1f5f9;
      --bg-muted-half: rgba(241,245,249,0.5);
      --bg-code: #1e293b;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --text-code: #e2e8f0;
      --primary: #2563eb;
      --primary-light: rgba(37,99,235,0.1);
      --get: #3b82f6;
      --post: #22c55e;
      --put: #f59e0b;
      --patch: #06b6d4;
      --delete: #ef4444;
      --purple: #a855f7;
      --radius: 8px;
    }

    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      font-size: 15px;
    }

    code, pre, .mono { font-family: ui-monospace, SFMono-Regular, 'Cascadia Code', monospace; }

    .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    /* ===== PUBLISH BANNER ===== */
    .publish-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 24px;
      border-bottom: 1px solid rgba(37,99,235,0.1);
      background: linear-gradient(90deg, rgba(37,99,235,0.04), rgba(99,102,241,0.04), rgba(168,85,247,0.04));
      font-size: 13px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .publish-banner-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .publish-banner-badges {
      display: flex;
      gap: 6px;
    }
    .publish-banner-badge {
      font-size: 10px;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .badge-purple { background: rgba(168,85,247,0.1); color: var(--purple); }
    .badge-blue { background: rgba(37,99,235,0.1); color: var(--primary); }
    .badge-green { background: rgba(34,197,94,0.1); color: var(--post); }
    .publish-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid rgba(37,99,235,0.2);
      background: rgba(37,99,235,0.1);
      color: var(--primary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
      text-decoration: none;
    }
    .publish-btn:hover { background: rgba(37,99,235,0.2); }

    /* ===== HEADER ===== */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 24px;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(12px);
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .header-logo {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      text-decoration: none;
    }
    .header-nav {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .header-nav-link {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 14px;
      color: var(--text-muted);
      text-decoration: none;
      border: none;
      background: none;
      cursor: pointer;
      transition: all 0.15s;
    }
    .header-nav-link:hover { background: var(--bg-muted-half); color: var(--text); }
    .header-nav-link.active { background: var(--bg-muted); color: var(--text); }
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* ===== SEARCH TRIGGER ===== */
    .search-trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-muted-half);
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
      width: 260px;
      transition: all 0.15s;
    }
    .search-trigger:hover { background: var(--bg-muted); }
    .search-trigger-text { flex: 1; text-align: left; }
    .search-trigger-hints { display: flex; align-items: center; gap: 6px; }
    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 500;
      padding: 2px 5px;
      border-radius: 4px;
      background: rgba(168,85,247,0.1);
      color: var(--purple);
    }
    kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 6px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg);
      font-size: 11px;
      font-weight: 500;
      font-family: inherit;
      color: var(--text-muted);
    }
    .search-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    /* ===== SEARCH MODAL ===== */
    .search-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      display: none;
    }
    .search-overlay.open { display: flex; align-items: center; justify-content: center; padding: 16px; }
    .search-modal {
      width: 100%;
      max-width: 512px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.25);
      overflow: hidden;
    }
    .search-input-row {
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding: 0 12px;
    }
    .search-mode-btn {
      padding: 6px;
      border-radius: 6px;
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      flex-shrink: 0;
      margin-right: 4px;
      transition: all 0.15s;
    }
    .search-mode-btn:hover { color: var(--text); }
    .search-mode-btn.ai-active { background: rgba(168,85,247,0.1); color: var(--purple); }
    .search-input {
      flex: 1;
      padding: 12px;
      border: none;
      outline: none;
      font-size: 14px;
      background: transparent;
      color: var(--text);
      font-family: inherit;
    }
    .search-input::placeholder { color: var(--text-muted); }
    .search-clear {
      padding: 4px;
      border-radius: 4px;
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
    }
    .search-clear:hover { background: var(--bg-muted); color: var(--text); }
    .search-results {
      max-height: 320px;
      overflow-y: auto;
      padding: 8px 0;
    }
    .search-result {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      width: 100%;
      border: none;
      background: none;
      text-align: left;
      font: inherit;
      color: var(--text);
      cursor: pointer;
      font-size: 14px;
      transition: background 0.1s;
    }
    .search-result:hover, .search-result.selected { background: var(--bg-muted); }
    .search-result-info { flex: 1; min-width: 0; }
    .search-result-label { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .search-result-meta { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .search-empty { padding: 32px 16px; text-align: center; font-size: 14px; color: var(--text-muted); }
    .search-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border);
      padding: 8px 12px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .search-footer-hints { display: flex; align-items: center; gap: 12px; }
    .search-footer-hint { display: flex; align-items: center; gap: 4px; }

    /* ===== BODY LAYOUT ===== */
    .body { display: flex; flex: 1; overflow: hidden; }

    /* ===== SIDEBAR ===== */
    .sidebar {
      width: 288px;
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 16px;
    }
    .sidebar-section { margin-bottom: 8px; }
    .sidebar-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      padding: 4px 12px;
      margin-bottom: 2px;
    }
    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-muted);
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      transition: all 0.15s;
      text-decoration: none;
    }
    .sidebar-item:hover { background: var(--bg-muted); color: var(--text); }
    .sidebar-item.active {
      background: var(--primary-light);
      color: var(--primary);
      font-weight: 500;
    }
    .method-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      min-width: 42px;
      text-align: center;
      flex-shrink: 0;
    }
    .method-badge.get { background: rgba(59,130,246,0.2); color: var(--get); }
    .method-badge.post { background: rgba(34,197,94,0.2); color: var(--post); }
    .method-badge.put { background: rgba(245,158,11,0.2); color: var(--put); }
    .method-badge.patch { background: rgba(6,182,212,0.2); color: var(--patch); }
    .method-badge.delete { background: rgba(239,68,68,0.2); color: var(--delete); }
    .method-badge-solid {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 4px;
      color: white;
      min-width: 52px;
      text-align: center;
      flex-shrink: 0;
    }
    .method-badge-solid.get { background: var(--get); }
    .method-badge-solid.post { background: var(--post); }
    .method-badge-solid.put { background: var(--put); }
    .method-badge-solid.patch { background: var(--patch); }
    .method-badge-solid.delete { background: var(--delete); }
    .method-badge-bordered {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 4px;
      min-width: 52px;
      text-align: center;
      flex-shrink: 0;
    }
    .method-badge-bordered.get { background: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }
    .method-badge-bordered.post { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
    .method-badge-bordered.put { background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
    .method-badge-bordered.patch { background: rgba(6,182,212,0.2); color: #22d3ee; border: 1px solid rgba(6,182,212,0.3); }
    .method-badge-bordered.delete { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
    .sidebar-item-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    /* ===== MAIN CONTENT ===== */
    .main { flex: 1; display: flex; overflow: hidden; }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 32px;
    }
    .content-inner { max-width: 768px; }

    /* Endpoint header */
    .ep-header { display: flex; align-items: flex-start; gap: 12px; }
    .ep-header .method-badge-solid { margin-top: 4px; }
    .ep-title { font-size: 24px; font-weight: 700; }
    .ep-url { font-size: 13px; color: var(--text-muted); margin-top: 2px; word-break: break-all; }
    .ep-desc { color: var(--text-muted); margin-top: 24px; line-height: 1.7; }
    .deprecated-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: #fef2f2;
      color: #dc2626;
      margin-left: 8px;
    }
    .auth-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--bg-muted);
      color: var(--text-muted);
      margin-top: 12px;
    }

    /* Params */
    .param-section { margin-top: 32px; }
    .param-section h3 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .param-table { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .param-row {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: baseline;
    }
    .param-row:last-child { border-bottom: none; }
    .param-name { font-weight: 600; font-size: 14px; }
    .param-type { font-size: 12px; color: var(--text-muted); }
    .param-required { font-size: 11px; color: #dc2626; font-weight: 500; }
    .param-default { font-size: 12px; color: var(--text-muted); }
    .param-desc { width: 100%; font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .param-enum { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; width: 100%; }
    .param-enum-val { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--bg-muted); }
    .param-nested {
      margin-left: 12px;
      padding-left: 12px;
      border-left: 2px solid var(--border);
      margin-top: 6px;
      width: 100%;
    }
    .param-nested .param-row { padding: 6px 0; border-bottom: none; font-size: 13px; }
    .param-input {
      width: 100%;
      margin-top: 6px;
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      font-family: ui-monospace, SFMono-Regular, 'Cascadia Code', monospace;
      background: var(--bg);
      color: var(--text);
      outline: none;
      transition: border-color 0.15s;
    }
    .param-input:focus { border-color: var(--primary); }
    .param-input::placeholder { color: var(--text-muted); opacity: 0.5; }

    /* Try It */
    .tryit-section { margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border); }
    .tryit-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 24px;
      border-radius: 8px;
      border: none;
      background: var(--primary);
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .tryit-btn:hover { opacity: 0.9; }
    .tryit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .tryit-btn .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Response viewer */
    .response-viewer { margin-top: 16px; }
    .response-viewer-header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 8px;
    }
    .response-status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 6px;
      font-size: 13px; font-weight: 600;
    }
    .response-status-badge.success { background: rgba(34,197,94,0.1); color: var(--post); }
    .response-status-badge.error { background: rgba(239,68,68,0.1); color: var(--delete); }
    .response-status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .response-status-badge.success .response-status-dot { background: var(--post); }
    .response-status-badge.error .response-status-dot { background: var(--delete); }
    .response-viewer-body {
      background: var(--bg-muted-half);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .response-viewer-body pre {
      padding: 16px; overflow-x: auto; font-size: 13px; line-height: 1.6; color: var(--text);
      max-height: 400px; overflow-y: auto;
    }

    /* Response */
    .response-section { margin-top: 32px; }
    .response-section h3 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .response-block { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 8px; }
    .response-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; background: var(--bg-subtle);
      cursor: pointer; border: none; width: 100%; text-align: left;
      font: inherit; color: inherit; transition: background 0.15s;
    }
    .response-header:hover { background: var(--bg-muted); }
    .response-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .response-dot.success { background: var(--post); }
    .response-status { font-weight: 600; font-size: 14px; }
    .response-label { color: var(--text-muted); font-size: 13px; }
    .response-body { border-top: 1px solid var(--border); }
    .response-schema { padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .response-schema-title {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px;
    }
    .schema-field { font-size: 13px; padding: 2px 0; }
    .schema-field-name { font-weight: 600; }
    .schema-field-type { font-size: 12px; color: var(--text-muted); margin-left: 4px; }
    .schema-field-req { font-size: 11px; color: #dc2626; margin-left: 4px; }
    .schema-field-desc { font-size: 12px; color: var(--text-muted); margin-left: 8px; }

    /* ===== CODE PANEL ===== */
    .code-panel {
      width: 420px;
      flex-shrink: 0;
      border-left: 1px solid var(--border);
      background: var(--bg-subtle);
      overflow-y: auto;
      padding: 24px;
    }
    .code-section-title {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px;
    }
    .lang-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 16px; }
    .lang-tab {
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 12px; border-radius: 8px; font-size: 11px;
      cursor: pointer; border: none; background: none; color: var(--text-muted);
      transition: all 0.15s;
    }
    .lang-tab:hover { background: var(--bg-muted-half); color: var(--text); }
    .lang-tab.active { background: var(--bg-muted); color: var(--text); font-weight: 600; }
    .lang-tab-icon { font-size: 10px; font-weight: 700; }
    .code-block {
      background: var(--bg-muted-half);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      margin-bottom: 16px;
    }
    .code-block-header {
      display: flex; align-items: center; justify-content: flex-end;
      padding: 6px 12px; border-bottom: 1px solid var(--border);
    }
    .copy-btn {
      background: none; border: none; color: var(--text-muted); opacity: 0.6;
      cursor: pointer; padding: 4px 8px; font-size: 12px; border-radius: 4px;
      transition: all 0.15s;
    }
    .copy-btn:hover { opacity: 1; background: var(--bg-muted); }
    .code-block pre {
      padding: 16px; overflow-x: auto; font-size: 13px; line-height: 1.6; color: var(--text);
    }
    .code-line { display: flex; }
    .code-line-num {
      color: var(--text-muted); opacity: 0.3; text-align: right;
      width: 24px; margin-right: 16px; flex-shrink: 0; user-select: none;
    }
    .example-section { margin-top: 24px; }

    /* ===== OVERVIEW PAGE ===== */
    .overview-title { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; }
    .overview-desc { color: var(--text-muted); margin-top: 12px; font-size: 16px; line-height: 1.7; }
    .overview-meta-box {
      margin-top: 24px;
      background: var(--bg-muted-half);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
    }
    .overview-meta-label { font-size: 12px; color: var(--text-muted); font-weight: 500; }
    .overview-meta-value { margin-top: 4px; font-size: 14px; }
    .overview-section-title { font-size: 20px; font-weight: 600; margin-top: 40px; margin-bottom: 8px; }
    .overview-ep-count { color: var(--text-muted); margin-bottom: 16px; }
    .overview-ep-card {
      display: flex; align-items: center; gap: 16px;
      padding: 16px; border: 1px solid var(--border); border-radius: var(--radius);
      margin-bottom: 12px; cursor: pointer; width: 100%;
      text-align: left; font: inherit; color: inherit; background: none;
      transition: all 0.15s;
    }
    .overview-ep-card:hover { background: var(--bg-subtle); border-color: var(--primary); }
    .overview-ep-info { flex: 1; min-width: 0; }
    .overview-ep-label { font-weight: 600; font-size: 14px; }
    .overview-ep-path { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .overview-ep-desc {
      font-size: 13px; color: var(--text-muted); margin-top: 4px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* ===== FOOTER ===== */
    .footer {
      border-top: 1px solid var(--border);
      padding: 16px 24px;
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .footer a { color: var(--primary); text-decoration: none; font-weight: 500; }
    .footer a:hover { text-decoration: underline; }

    /* ===== SVG ICONS ===== */
    .icon { width: 16px; height: 16px; display: inline-block; vertical-align: middle; }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 1200px) { .code-panel { display: none; } }
    @media (max-width: 1024px) { .sidebar { display: none; } }
    @media (max-width: 768px) {
      .content { padding: 20px; }
      .publish-banner { flex-direction: column; gap: 8px; padding: 8px 16px; }
      .search-trigger { width: 180px; }
      .search-trigger-text, .search-trigger-hints { display: none; }
    }
  </style>
</head>
<body>
  <div class="app" id="app"></div>

  <script>
  (function() {
    var spec = ${specJson};
    var currentIdx = -1;
    var selectedLang = 'shell';
    var searchOpen = false;
    var searchQuery = '';
    var searchSelectedIdx = 0;
    var paramValues = {};
    var tryItLoading = false;
    var tryItResponse = null;

    var METHODS = ['get','post','put','patch','delete'];
    var LANGS = [
      { id: 'shell', label: 'Shell', icon: '//' },
      { id: 'node', label: 'Node', icon: 'JS' },
      { id: 'python', label: 'Python', icon: 'Py' },
    ];

    // ===== ICONS =====
    var ICON = {
      search: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
      sparkles: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
      lock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
      x: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
      arrow: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
      rocket: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    };

    // ===== SPEC HELPERS =====
    function getEndpoints() {
      var eps = []; var paths = spec.paths || {};
      for (var path in paths) { var pi = paths[path];
        for (var i = 0; i < METHODS.length; i++) { var m = METHODS[i]; var op = pi[m];
          if (op) eps.push({ method: m.toUpperCase(), path: path, opId: op.operationId || m+'-'+path, summary: op.summary || '', description: op.description || op.summary || '', tags: op.tags || [], deprecated: !!op.deprecated, parameters: op.parameters || [], requestBody: op.requestBody, responses: op.responses || {} });
        }
      }
      return eps;
    }
    function getInfo() { var i = spec.info || {}; return { title: i.title || 'API Documentation', version: i.version || '', description: i.description || '' }; }
    function getBaseUrl() {
      if (spec.servers && spec.servers[0]) return spec.servers[0].url;
      if (spec.host) return (spec.schemes && spec.schemes[0] || 'https') + '://' + spec.host + (spec.basePath || '');
      return 'https://api.example.com';
    }
    function getAuthType() {
      var s = (spec.components && spec.components.securitySchemes) || spec.securityDefinitions || {};
      for (var n in s) { var sc = s[n];
        if (sc.type === 'http' && sc.scheme === 'bearer') return 'Bearer Token';
        if (sc.type === 'apiKey') return 'API Key (' + sc.in + ': ' + sc.name + ')';
        if (sc.type === 'oauth2') return 'OAuth 2.0';
      }
      return 'None';
    }
    function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
    function resolveRef(r) { if (!r || !r.$ref) return r; var p = r.$ref.replace('#/','').split('/'); var o = spec; for (var i=0;i<p.length;i++){o=o[p[i]];if(!o)return {};} return o; }
    function groupByTag(eps) { var g={},o=[]; eps.forEach(function(e){ var t=(e.tags&&e.tags[0])||'Default'; if(!g[t]){g[t]=[];o.push(t);} g[t].push(e); }); return {groups:g,order:o}; }

    function getSchemaFields(schema, depth) {
      if (!schema) return []; depth = depth||0; if (depth>3) return [];
      schema = resolveRef(schema);
      if (schema.type==='object' && schema.properties) {
        var req = schema.required||[];
        return Object.keys(schema.properties).map(function(k){
          var p = resolveRef(schema.properties[k]);
          return {key:k,type:p.type||'any',format:p.format,required:req.indexOf(k)!==-1,description:p.description||'',enum:p.enum,properties:p.type==='object'?getSchemaFields(p,depth+1):null};
        });
      }
      if (schema.type==='array'&&schema.items) return getSchemaFields(resolveRef(schema.items),depth);
      return [];
    }
    function getParams(ep,loc) {
      return (ep.parameters||[]).map(resolveRef).filter(function(p){return p.in===loc;}).map(function(p){
        var s=resolveRef(p.schema)||{};
        return {key:p.name,type:s.type||p.type||'string',format:s.format||p.format,required:!!p.required,description:p.description||'',default:s.default!==undefined?s.default:p.default,enum:s.enum||p.enum};
      });
    }
    function getBodySchema(ep) {
      if (!ep.requestBody) return []; var rb=resolveRef(ep.requestBody); var c=rb.content; if(!c) return [];
      var j=c['application/json']||c['application/x-www-form-urlencoded']; if(!j||!j.schema)return[];
      return getSchemaFields(j.schema);
    }
    function getResponseSchema(ep) {
      var r=ep.responses['200']||ep.responses['201']||ep.responses['2XX']; if(!r)return[]; r=resolveRef(r);
      if(!r.content){if(r.schema)return getSchemaFields(r.schema);return[];}
      var j=r.content['application/json']; if(!j||!j.schema)return[]; return getSchemaFields(j.schema);
    }
    function genExample(fields) {
      var o={}; (fields||[]).forEach(function(f){
        if(f.type==='string')o[f.key]=f.format==='date-time'?'2025-01-01T00:00:00Z':'example_'+f.key;
        else if(f.type==='integer'||f.type==='number')o[f.key]=0;
        else if(f.type==='boolean')o[f.key]=true;
        else if(f.type==='array')o[f.key]=[];
        else if(f.type==='object')o[f.key]=f.properties?genExample(f.properties):{};
        else o[f.key]=null;
      }); return o;
    }

    // ===== CODE GEN =====
    function genCurl(m,u,b){var l=['curl --request '+m+' \\\\'];l.push("     --url '"+u+"' \\\\");l.push("     --header 'accept: application/json' \\\\");l.push("     --header 'content-type: application/json'");if(b){l[l.length-1]+=' \\\\';l.push("     --data '"+JSON.stringify(b,null,2)+"'");}return l.join('\\n');}
    function genNode(m,u,b){var l=["const options = {","  method: '"+m+"',","  headers: {","    accept: 'application/json',","    'content-type': 'application/json'","  }"+(b?',':'')];if(b)l.push("  body: JSON.stringify("+JSON.stringify(b,null,4).split('\\n').join('\\n  ')+")");l.push("};","","fetch('"+u+"', options)","  .then(res => res.json())","  .then(json => console.log(json));");return l.join('\\n');}
    function genPython(m,u,b){var l=["import requests","","url = \\""+u+"\\"","headers = {","    \\"accept\\": \\"application/json\\",","    \\"content-type\\": \\"application/json\\"","}"];if(b){l.push("","payload = "+JSON.stringify(b,null,4),"","response = requests."+m.toLowerCase()+"(url, json=payload, headers=headers)");}else{l.push("","response = requests."+m.toLowerCase()+"(url, headers=headers)");}l.push("print(response.json())");return l.join('\\n');}

    // ===== DYNAMIC URL + TRY IT =====
    function buildDynamicUrl(baseUrl, ep) {
      var url = baseUrl + ep.path;
      var pathP = getParams(ep,'path');
      pathP.forEach(function(p){
        var v = paramValues['path:'+p.key];
        if(v) url = url.replace('{'+p.key+'}', encodeURIComponent(v));
      });
      var queryP = getParams(ep,'query');
      var qs = [];
      queryP.forEach(function(p){
        var v = paramValues['query:'+p.key];
        if(v) qs.push(encodeURIComponent(p.key)+'='+encodeURIComponent(v));
      });
      if(qs.length) url += '?' + qs.join('&');
      return url;
    }

    function buildBodyObj(ep) {
      var bodyP = getBodySchema(ep);
      if(!bodyP.length) return null;
      var obj = {};
      bodyP.forEach(function(p){
        var v = paramValues['body:'+p.key];
        if(v !== undefined && v !== '') {
          if(p.type==='integer'||p.type==='number') obj[p.key] = Number(v)||0;
          else if(p.type==='boolean') obj[p.key] = v==='true';
          else obj[p.key] = v;
        }
      });
      return Object.keys(obj).length ? obj : null;
    }

    // ===== RENDER HELPERS =====
    function renderParamRow(p, prefix) {
      var inputId = prefix ? prefix+':'+p.key : p.key;
      var curVal = paramValues[inputId] || '';
      var h = '<div class="param-row"><span class="param-name">'+esc(p.key)+'</span><span class="param-type mono">'+esc(p.type)+(p.format?' &lt;'+esc(p.format)+'&gt;':'')+'</span>';
      if(p.required)h+='<span class="param-required">required</span>';
      if(p.default!==undefined&&p.default!==null)h+='<span class="param-default">Default: '+esc(String(p.default))+'</span>';
      if(p.description)h+='<div class="param-desc">'+esc(p.description)+'</div>';
      if(p.enum&&p.enum.length){h+='<div class="param-enum">';p.enum.forEach(function(v){h+='<span class="param-enum-val mono">'+esc(v)+'</span>';});h+='</div>';}
      // Interactive input
      if(prefix && !p.properties) {
        var placeholder = p.enum && p.enum.length ? p.enum[0] : (p.type==='integer'||p.type==='number'?'0':p.type==='boolean'?'true':'');
        h += '<input class="param-input" data-param="'+esc(inputId)+'" placeholder="'+esc(placeholder||p.key)+'" value="'+esc(curVal)+'" oninput="onParamChange(this.dataset.param,this.value)"/>';
      }
      if(p.properties&&p.properties.length){h+='<div class="param-nested">';p.properties.forEach(function(np){h+=renderParamRow(np, prefix);});h+='</div>';}
      return h+'</div>';
    }
    function renderParams(title,params,prefix) {
      if(!params||!params.length)return '';
      var h='<div class="param-section"><h3>'+esc(title)+'</h3><div class="param-table">';
      params.forEach(function(p){h+=renderParamRow(p,prefix);});
      return h+'</div></div>';
    }
    function renderSchemaFields(fields) {
      var h='';(fields||[]).forEach(function(f){
        h+='<div class="schema-field"><span class="schema-field-name">'+esc(f.key)+'</span><span class="schema-field-type mono">'+esc(f.type)+(f.format?' &lt;'+esc(f.format)+'&gt;':'')+'</span>';
        if(f.required)h+='<span class="schema-field-req">required</span>';
        if(f.description)h+='<span class="schema-field-desc">\u2014 '+esc(f.description)+'</span>';
        h+='</div>';
      }); return h;
    }
    function renderCodeBlock(code) {
      var lines=code.split('\\n');
      var h='<div class="code-block"><div class="code-block-header"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><pre><code>';
      lines.forEach(function(l,i){h+='<div class="code-line"><span class="code-line-num">'+(i+1)+'</span><span>'+esc(l)+'</span></div>';});
      return h+'</code></pre></div>';
    }

    // ===== SEARCH =====
    function getSearchResults() {
      var eps = getEndpoints();
      if (!searchQuery.trim()) return eps.slice(0,10).map(function(e,i){return {ep:e,idx:i};});
      var q = searchQuery.toLowerCase();
      return eps.map(function(e,i){
        var score=0;
        [e.summary,e.path,e.method,e.description,e.opId].forEach(function(f){
          if(!f)return; var lf=f.toLowerCase();
          if(lf===q)score+=100; else if(lf.startsWith(q))score+=50; else if(lf.indexOf(q)!==-1)score+=25;
        });
        return {ep:e,idx:i,score:score};
      }).filter(function(r){return r.score>0;}).sort(function(a,b){return b.score-a.score;}).slice(0,15);
    }

    // ===== MAIN RENDER =====
    function render() {
      var endpoints = getEndpoints();
      var info = getInfo();
      var baseUrl = getBaseUrl();
      var authType = getAuthType();
      var tagged = groupByTag(endpoints);
      var mc = function(m){return m.toLowerCase();};
      var html = '';

      // Publish banner
      html += '<div class="publish-banner"><div class="publish-banner-left"><span>Preview mode</span><div class="publish-banner-badges"><span class="publish-banner-badge badge-purple">'+ICON.sparkles+' AI Search</span><span class="publish-banner-badge badge-blue">Custom Domain</span><span class="publish-banner-badge badge-green">Analytics</span></div></div><a class="publish-btn" href="https://specway.com" target="_blank">'+ICON.rocket+' Publish Live Docs</a></div>';

      // Header
      html += '<div class="header"><div class="header-left"><a class="header-logo" href="javascript:selectEndpoint(-1)">'+esc(info.title)+'</a><nav class="header-nav"><button class="header-nav-link active" onclick="selectEndpoint(-1)">API Reference</button></nav></div>';
      html += '<div class="header-right"><button class="search-trigger" onclick="openSearch()">'+ICON.search+'<span class="search-trigger-text">Search...</span><span class="search-trigger-hints"><span class="ai-badge">'+ICON.sparkles+' AI</span><kbd>/</kbd></span></button></div></div>';

      // Body
      html += '<div class="body">';

      // Sidebar
      html += '<div class="sidebar">';
      html += '<div class="sidebar-section"><button class="sidebar-item'+(currentIdx===-1?' active':'')+'" onclick="selectEndpoint(-1)">Overview</button></div>';
      tagged.order.forEach(function(tag){
        html += '<div class="sidebar-section"><div class="sidebar-section-title">'+esc(tag)+'</div>';
        tagged.groups[tag].forEach(function(ep){
          var idx=endpoints.indexOf(ep);
          html += '<button class="sidebar-item'+(currentIdx===idx?' active':'')+'" onclick="selectEndpoint('+idx+')"><span class="method-badge '+mc(ep.method)+'">'+ep.method+'</span><span class="sidebar-item-label">'+esc(ep.summary||ep.path)+'</span></button>';
        });
        html += '</div>';
      });
      html += '</div>';

      // Main
      html += '<div class="main">';

      if (currentIdx === -1) {
        // Overview
        html += '<div class="content"><div class="content-inner">';
        html += '<div class="overview-title">'+esc(info.title)+'</div>';
        if(info.description) html += '<div class="overview-desc">'+esc(info.description)+'</div>';
        html += '<div class="overview-meta-box"><div class="overview-meta-label">Base URL</div><code class="overview-meta-value">'+esc(baseUrl)+'</code></div>';
        html += '<div class="overview-section-title">Endpoints</div>';
        html += '<div class="overview-ep-count">'+endpoints.length+' endpoints \u00b7 Auth: '+esc(authType)+'</div>';
        endpoints.forEach(function(ep,idx){
          html += '<button class="overview-ep-card" onclick="selectEndpoint('+idx+')"><span class="method-badge-bordered '+mc(ep.method)+'">'+ep.method+'</span><div class="overview-ep-info"><div class="overview-ep-label">'+esc(ep.summary||ep.opId)+'</div><div class="overview-ep-path mono">'+esc(ep.path)+'</div>';
          if(ep.description) html += '<div class="overview-ep-desc">'+esc(ep.description)+'</div>';
          html += '</div></button>';
        });
        html += '</div></div>';
      } else {
        // Endpoint detail
        var ep = endpoints[currentIdx];
        var dynamicUrl = buildDynamicUrl(baseUrl, ep);
        var fullUrl = baseUrl + ep.path;
        var pathP = getParams(ep,'path');
        var queryP = getParams(ep,'query');
        var bodyP = getBodySchema(ep);
        var respF = getResponseSchema(ep);

        html += '<div class="content"><div class="content-inner">';
        html += '<div class="ep-header"><span class="method-badge-solid '+mc(ep.method)+'">'+ep.method+'</span><div><div class="ep-title">'+esc(ep.summary||ep.opId)+(ep.deprecated?'<span class="deprecated-tag">Deprecated</span>':'')+'</div><div class="ep-url mono">'+esc(dynamicUrl)+'</div></div></div>';
        if(ep.description) html += '<div class="ep-desc">'+esc(ep.description)+'</div>';
        html += '<div class="auth-badge">'+ICON.lock+' '+esc(authType)+'</div>';
        html += renderParams('Path Parameters',pathP,'path');
        html += renderParams('Query Parameters',queryP,'query');
        html += renderParams('Request Body',bodyP,'body');

        if(respF.length){
          html += '<div class="response-section"><h3>Responses</h3><div class="response-block"><button class="response-header" onclick="var b=this.nextElementSibling;b.style.display=b.style.display===\\'none\\'?\\'block\\':\\'none\\'"><span class="response-dot success"></span><span class="response-status">200</span><span class="response-label">Success</span></button><div class="response-body"><div class="response-schema"><div class="response-schema-title">Schema</div>'+renderSchemaFields(respF)+'</div></div></div></div>';
        }
        html += '</div></div>';

        // Code panel with Try It
        var hasBody = bodyP.length>0 && ['POST','PUT','PATCH'].indexOf(ep.method)!==-1;
        var dynamicBody = buildBodyObj(ep);
        var bodyForCode = dynamicBody || (hasBody ? genExample(bodyP) : null);
        var codes = { shell: genCurl(ep.method,dynamicUrl,bodyForCode), node: genNode(ep.method,dynamicUrl,bodyForCode), python: genPython(ep.method,dynamicUrl,bodyForCode) };

        html += '<div class="code-panel">';
        html += '<div class="code-section-title">Language</div><div class="lang-tabs">';
        LANGS.forEach(function(l){ html += '<button class="lang-tab'+(selectedLang===l.id?' active':'')+'" onclick="setLang(\\''+l.id+'\\')"><span class="lang-tab-icon">'+l.icon+'</span><span>'+l.label+'</span></button>'; });
        html += '</div>';
        html += '<div class="code-section-title">Request</div>' + renderCodeBlock(codes[selectedLang]);

        // Try It button
        html += '<div class="tryit-section">';
        html += '<button class="tryit-btn" onclick="handleTryIt()" '+(tryItLoading?'disabled':'')+'>'+
          (tryItLoading?'<span class="spinner"></span> Sending...':ICON.rocket+' Try It!')+
          '</button>';

        // Response viewer
        if (tryItResponse) {
          var isSuccess = tryItResponse.status >= 200 && tryItResponse.status < 300;
          html += '<div class="response-viewer"><div class="response-viewer-header"><span class="response-status-badge '+(isSuccess?'success':'error')+'"><span class="response-status-dot"></span>'+tryItResponse.status+' - '+(isSuccess?'OK':'Error')+'</span></div>';
          html += '<div class="response-viewer-body"><pre><code>'+esc(tryItResponse.data)+'</code></pre></div></div>';
        }
        html += '</div>';

        if(respF.length) html += '<div class="example-section"><div class="code-section-title">Example Response</div>'+renderCodeBlock(JSON.stringify(genExample(respF),null,2))+'</div>';
        html += '</div>';
      }

      html += '</div></div>';

      // Footer
      html += '<div class="footer">Powered by <a href="https://specway.com" target="_blank">Specway</a></div>';

      // Search overlay
      var results = getSearchResults();
      html += '<div class="search-overlay'+(searchOpen?' open':'')+'" id="searchOverlay" onclick="if(event.target===this)closeSearch()">';
      html += '<div class="search-modal"><div class="search-input-row"><button class="search-mode-btn" title="Search">'+ICON.search+'</button><input class="search-input" id="searchInput" placeholder="Search endpoints..." value="'+esc(searchQuery)+'" oninput="onSearchInput(this.value)" onkeydown="onSearchKey(event)"><button class="search-clear" onclick="searchQuery=\\'\\';render();document.getElementById(\\'searchInput\\').focus()">'+ICON.x+'</button></div>';
      html += '<div class="search-results">';
      if(results.length===0){ html += '<div class="search-empty">No results found</div>'; }
      else { results.forEach(function(r,i){
        html += '<button class="search-result'+(i===searchSelectedIdx?' selected':'')+'" onclick="selectEndpoint('+r.idx+');closeSearch()" data-idx="'+i+'"><span class="method-badge '+mc(r.ep.method)+'">'+r.ep.method+'</span><div class="search-result-info"><div class="search-result-label">'+esc(r.ep.summary||r.ep.opId)+'</div><div class="search-result-meta mono">'+esc(r.ep.path)+'</div></div></button>';
      }); }
      html += '</div>';
      html += '<div class="search-footer"><div class="search-footer-hints"><span class="search-footer-hint"><kbd>\u2191</kbd><kbd>\u2193</kbd> navigate</span><span class="search-footer-hint"><kbd>\u21b5</kbd> select</span></div><span class="search-footer-hint"><kbd>esc</kbd> close</span></div>';
      html += '</div></div>';

      document.getElementById('app').innerHTML = html;
      if (searchOpen) { var si = document.getElementById('searchInput'); if(si) si.focus(); }
    }

    // ===== GLOBAL HANDLERS =====
    window.selectEndpoint = function(i) { currentIdx = i; paramValues = {}; tryItResponse = null; tryItLoading = false; render(); };
    window.setLang = function(l) { selectedLang = l; render(); };
    window.onParamChange = function(key, val) {
      paramValues[key] = val;
      render();
      // Restore focus to the input that was being edited
      var el = document.querySelector('[data-param="'+key+'"]');
      if(el) { el.focus(); var len = el.value.length; el.setSelectionRange(len,len); }
    };
    window.handleTryIt = function() {
      var endpoints = getEndpoints();
      if(currentIdx<0||currentIdx>=endpoints.length) return;
      var ep = endpoints[currentIdx];
      var url = buildDynamicUrl(getBaseUrl(), ep);
      var hasBody = getBodySchema(ep).length>0 && ['POST','PUT','PATCH'].indexOf(ep.method)!==-1;
      var body = buildBodyObj(ep);

      tryItLoading = true; tryItResponse = null; render();

      // Use local proxy to avoid CORS issues
      var proxyUrl = '/__proxy?url=' + encodeURIComponent(url);
      var opts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Proxy-Method': ep.method,
          'X-Proxy-Content-Type': 'application/json'
        }
      };
      if(hasBody && body) opts.body = JSON.stringify(body);

      fetch(proxyUrl, opts).then(function(res){
        return res.text().then(function(text){
          var formatted = text;
          try { formatted = JSON.stringify(JSON.parse(text),null,2); } catch(e){}
          tryItResponse = { status: res.status, data: formatted };
          tryItLoading = false; render();
        });
      }).catch(function(err){
        tryItResponse = { status: 0, data: 'Error: ' + (err.message || 'Request failed') };
        tryItLoading = false; render();
      });
    };
    window.openSearch = function() { searchOpen = true; searchQuery = ''; searchSelectedIdx = 0; render(); };
    window.closeSearch = function() { searchOpen = false; searchQuery = ''; render(); };
    window.onSearchInput = function(v) { searchQuery = v; searchSelectedIdx = 0; render(); document.getElementById('searchInput').focus(); };
    window.onSearchKey = function(e) {
      var results = getSearchResults();
      if(e.key==='ArrowDown'){e.preventDefault();searchSelectedIdx=Math.min(searchSelectedIdx+1,results.length-1);render();document.getElementById('searchInput').focus();}
      else if(e.key==='ArrowUp'){e.preventDefault();searchSelectedIdx=Math.max(searchSelectedIdx-1,0);render();document.getElementById('searchInput').focus();}
      else if(e.key==='Enter'&&results[searchSelectedIdx]){e.preventDefault();selectEndpoint(results[searchSelectedIdx].idx);closeSearch();}
      else if(e.key==='Escape'){closeSearch();}
    };
    window.copyCode = function(btn) {
      var code = btn.closest('.code-block').querySelector('code').textContent;
      navigator.clipboard.writeText(code).then(function(){ btn.textContent='Copied!'; setTimeout(function(){btn.textContent='Copy';},2000); });
    };

    document.addEventListener('keydown', function(e) {
      if(e.key==='/'&&!searchOpen&&document.activeElement.tagName!=='INPUT'){e.preventDefault();openSearch();}
      if(e.key==='Escape'&&searchOpen){closeSearch();}
    });

    render();

    // SSE hot-reload
    var evtSource = new EventSource('/__sse');
    evtSource.addEventListener('reload', function(e) { spec = JSON.parse(e.data); render(); });
  })();
  </script>
</body>
</html>`;
}

export async function startPreviewServer(options: PreviewOptions): Promise<void> {
  let specJson = loadSpecJson(options.specPath);

  const clients = new Set<ServerResponse>();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/__sse') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(':\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    // CORS proxy for Try It requests
    if (req.url?.startsWith('/__proxy?')) {
      const targetUrl = new URL(req.url, `http://localhost:${options.port}`).searchParams.get('url');
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing url parameter' }));
        return;
      }

      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const headers: Record<string, string> = {
            'Content-Type': req.headers['x-proxy-content-type'] as string || 'application/json',
            'Accept': 'application/json',
          };
          const authHeader = req.headers['x-proxy-authorization'] as string;
          if (authHeader) headers['Authorization'] = authHeader;

          const fetchOpts: RequestInit = {
            method: req.headers['x-proxy-method'] as string || 'GET',
            headers,
          };
          if (body && ['POST', 'PUT', 'PATCH'].includes(fetchOpts.method as string)) {
            fetchOpts.body = body;
          }

          const proxyRes = await fetch(targetUrl, fetchOpts);
          const proxyBody = await proxyRes.text();

          res.writeHead(proxyRes.status, {
            'Content-Type': proxyRes.headers.get('content-type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(proxyBody);
        } catch (err) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Proxy error' }));
        }
      });
      return;
    }

    const html = buildHtml(specJson);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  const watcher = watch(options.specPath, { ignoreInitial: true });
  watcher.on('change', () => {
    try {
      specJson = loadSpecJson(options.specPath);
      for (const client of clients) {
        client.write(`event: reload\ndata: ${specJson}\n\n`);
      }
    } catch {
      // Ignore parse errors during editing
    }
  });

  server.listen(options.port, () => {
    const url = `http://localhost:${options.port}`;
    console.log(`\n  Preview server running at ${url}\n`);
    console.log('  Watching for changes... (Ctrl+C to stop)\n');

    if (options.open) {
      import('open').then((mod) => mod.default(url)).catch(() => {});
    }
  });

  const shutdown = () => {
    watcher.close();
    for (const client of clients) client.end();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
