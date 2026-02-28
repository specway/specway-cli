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
      --bg-code: #1e293b;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --text-code: #e2e8f0;
      --primary: #2563eb;
      --get: #3b82f6;
      --post: #22c55e;
      --put: #f59e0b;
      --patch: #06b6d4;
      --delete: #ef4444;
      --sidebar-w: 280px;
      --code-panel-w: 420px;
    }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      font-size: 15px;
    }

    /* Layout */
    .app { display: flex; height: 100vh; overflow: hidden; }

    /* Sidebar */
    .sidebar {
      width: var(--sidebar-w);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      flex-shrink: 0;
      background: var(--bg);
    }
    .sidebar-header {
      padding: 20px 16px 12px;
      border-bottom: 1px solid var(--border);
    }
    .sidebar-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
    }
    .sidebar-version {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .sidebar-section {
      padding: 12px 0;
    }
    .sidebar-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      padding: 4px 16px;
      margin-bottom: 2px;
    }
    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      cursor: pointer;
      text-decoration: none;
      color: var(--text);
      font-size: 13px;
      transition: background 0.15s;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
    }
    .sidebar-item:hover { background: var(--bg-muted); }
    .sidebar-item.active { background: var(--bg-muted); font-weight: 600; }
    .method-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      color: white;
      min-width: 46px;
      text-align: center;
      flex-shrink: 0;
    }
    .method-badge.get { background: var(--get); }
    .method-badge.post { background: var(--post); }
    .method-badge.put { background: var(--put); }
    .method-badge.patch { background: var(--patch); }
    .method-badge.delete { background: var(--delete); }
    .sidebar-item-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Main content */
    .main { flex: 1; display: flex; overflow: hidden; }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 32px 40px;
    }
    .content-inner { max-width: 720px; }

    /* Endpoint header */
    .endpoint-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
    }
    .endpoint-header .method-badge {
      font-size: 12px;
      padding: 4px 10px;
      margin-top: 4px;
    }
    .endpoint-title { font-size: 24px; font-weight: 700; }
    .endpoint-url {
      font-family: ui-monospace, monospace;
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
      word-break: break-all;
    }
    .endpoint-description {
      color: var(--text-muted);
      margin-top: 16px;
      line-height: 1.7;
    }
    .deprecated-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: #fef2f2;
      color: #dc2626;
      margin-left: 8px;
    }

    /* Auth badge */
    .auth-info {
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }
    .auth-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 6px;
      background: var(--bg-muted);
      color: var(--text-muted);
    }
    .auth-badge svg { width: 12px; height: 12px; }

    /* Parameter sections */
    .param-section { margin-top: 32px; }
    .param-section h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .param-table {
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
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
    .param-type {
      font-size: 12px;
      color: var(--text-muted);
      font-family: ui-monospace, monospace;
    }
    .param-required {
      font-size: 11px;
      color: #dc2626;
      font-weight: 500;
    }
    .param-default {
      font-size: 12px;
      color: var(--text-muted);
    }
    .param-desc {
      width: 100%;
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .param-enum {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
      width: 100%;
    }
    .param-enum-val {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--bg-muted);
      font-family: ui-monospace, monospace;
    }
    .param-nested {
      margin-left: 16px;
      padding-left: 12px;
      border-left: 2px solid var(--border);
      margin-top: 6px;
      width: 100%;
    }
    .param-nested .param-row {
      padding: 6px 0;
      border-bottom: none;
      font-size: 13px;
    }

    /* Response section */
    .response-section { margin-top: 32px; }
    .response-section h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .response-block {
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .response-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--bg-subtle);
      cursor: pointer;
      border: none;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .response-header:hover { background: var(--bg-muted); }
    .response-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .response-dot.success { background: var(--post); }
    .response-dot.error { background: var(--delete); }
    .response-status { font-weight: 600; font-size: 14px; }
    .response-label { color: var(--text-muted); font-size: 13px; }
    .response-body {
      border-top: 1px solid var(--border);
    }
    .response-schema {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .response-schema-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .schema-field {
      font-size: 13px;
      padding: 2px 0;
    }
    .schema-field-name { font-weight: 600; }
    .schema-field-type {
      font-size: 12px;
      color: var(--text-muted);
      margin-left: 4px;
      font-family: ui-monospace, monospace;
    }
    .schema-field-required {
      font-size: 11px;
      color: #dc2626;
      margin-left: 4px;
    }
    .schema-field-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-left: 8px;
    }

    /* Code panel */
    .code-panel {
      width: var(--code-panel-w);
      flex-shrink: 0;
      border-left: 1px solid var(--border);
      background: var(--bg-subtle);
      overflow-y: auto;
      padding: 24px;
    }
    .code-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .lang-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 16px;
    }
    .lang-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.15s;
      border: none;
      background: none;
      color: var(--text-muted);
    }
    .lang-tab:hover { background: var(--bg-muted); color: var(--text); }
    .lang-tab.active { background: var(--bg-muted); color: var(--text); font-weight: 600; }
    .lang-tab-icon { font-size: 10px; font-weight: 700; }
    .code-block {
      background: var(--bg-code);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .code-block-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 6px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .copy-btn {
      background: none;
      border: none;
      color: var(--text-code);
      opacity: 0.5;
      cursor: pointer;
      padding: 4px;
      font-size: 12px;
    }
    .copy-btn:hover { opacity: 1; }
    .code-block pre {
      padding: 16px;
      overflow-x: auto;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-code);
    }
    .code-line {
      display: flex;
    }
    .code-line-num {
      color: rgba(255,255,255,0.2);
      text-align: right;
      width: 24px;
      margin-right: 16px;
      flex-shrink: 0;
      user-select: none;
    }

    /* Example response in code panel */
    .example-section { margin-top: 24px; }

    /* Overview page */
    .overview-header { margin-bottom: 32px; }
    .overview-title { font-size: 28px; font-weight: 700; }
    .overview-desc { color: var(--text-muted); margin-top: 8px; line-height: 1.7; }
    .overview-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 16px;
    }
    .overview-meta-item {
      font-size: 13px;
      color: var(--text-muted);
    }
    .overview-meta-item strong { color: var(--text); }
    .overview-endpoints-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .overview-endpoint {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      background: none;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .overview-endpoint:hover {
      background: var(--bg-subtle);
      border-color: var(--primary);
    }
    .overview-ep-info { flex: 1; min-width: 0; }
    .overview-ep-label { font-weight: 600; font-size: 14px; }
    .overview-ep-path {
      font-size: 12px;
      color: var(--text-muted);
      font-family: ui-monospace, monospace;
      margin-top: 2px;
    }
    .overview-ep-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Branding */
    .powered-by {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--text-muted);
      text-align: center;
    }
    .powered-by a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }
    .powered-by a:hover { text-decoration: underline; }

    /* Responsive */
    @media (max-width: 1200px) {
      .code-panel { display: none; }
    }
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .content { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="app" id="app"></div>

  <script>
  (function() {
    var spec = ${specJson};
    var currentEndpointIdx = -1; // -1 = overview

    var METHOD_COLORS = { GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch', DELETE: 'delete' };
    var LANGS = [
      { id: 'shell', label: 'Shell', icon: '//' },
      { id: 'node', label: 'Node', icon: 'JS' },
      { id: 'python', label: 'Python', icon: 'Py' },
    ];
    var selectedLang = 'shell';

    function getEndpoints() {
      var endpoints = [];
      var paths = spec.paths || {};
      var methods = ['get','post','put','patch','delete'];
      for (var path in paths) {
        var pathItem = paths[path];
        for (var i = 0; i < methods.length; i++) {
          var m = methods[i];
          var op = pathItem[m];
          if (op) {
            endpoints.push({
              method: m.toUpperCase(),
              path: path,
              operationId: op.operationId || m + '-' + path,
              summary: op.summary || '',
              description: op.description || op.summary || '',
              tags: op.tags || [],
              deprecated: op.deprecated || false,
              parameters: op.parameters || [],
              requestBody: op.requestBody,
              responses: op.responses || {},
            });
          }
        }
      }
      return endpoints;
    }

    function getInfo() {
      var info = spec.info || {};
      return {
        title: info.title || 'API Documentation',
        version: info.version || '',
        description: info.description || '',
        contact: info.contact,
      };
    }

    function getBaseUrl() {
      if (spec.servers && spec.servers.length > 0) return spec.servers[0].url;
      if (spec.host) {
        var scheme = (spec.schemes && spec.schemes[0]) || 'https';
        return scheme + '://' + spec.host + (spec.basePath || '');
      }
      return 'https://api.example.com';
    }

    function getAuthType() {
      var schemes = {};
      if (spec.components && spec.components.securitySchemes) schemes = spec.components.securitySchemes;
      else if (spec.securityDefinitions) schemes = spec.securityDefinitions;
      for (var name in schemes) {
        var s = schemes[name];
        if (s.type === 'http' && s.scheme === 'bearer') return 'Bearer Token';
        if (s.type === 'apiKey') return 'API Key (' + s.in + ': ' + s.name + ')';
        if (s.type === 'oauth2') return 'OAuth 2.0';
      }
      return 'None';
    }

    function esc(str) {
      var div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }

    function groupByTag(endpoints) {
      var groups = {};
      var order = [];
      endpoints.forEach(function(ep) {
        var tag = (ep.tags && ep.tags[0]) || 'Default';
        if (!groups[tag]) { groups[tag] = []; order.push(tag); }
        groups[tag].push(ep);
      });
      return { groups: groups, order: order };
    }

    function resolveRef(ref) {
      if (!ref || !ref.$ref) return ref;
      var parts = ref.$ref.replace('#/', '').split('/');
      var obj = spec;
      for (var i = 0; i < parts.length; i++) { obj = obj[parts[i]]; if (!obj) return {}; }
      return obj;
    }

    function getSchemaFields(schema, depth) {
      if (!schema) return [];
      depth = depth || 0;
      if (depth > 3) return [];
      schema = resolveRef(schema);
      if (schema.type === 'object' && schema.properties) {
        var required = schema.required || [];
        return Object.keys(schema.properties).map(function(key) {
          var prop = resolveRef(schema.properties[key]);
          return {
            key: key,
            type: prop.type || 'any',
            format: prop.format,
            required: required.indexOf(key) !== -1,
            description: prop.description || '',
            enum: prop.enum,
            properties: prop.type === 'object' ? getSchemaFields(prop, depth + 1) : null,
          };
        });
      }
      if (schema.type === 'array' && schema.items) {
        return getSchemaFields(resolveRef(schema.items), depth);
      }
      return [];
    }

    function getParams(ep, location) {
      return (ep.parameters || [])
        .map(function(p) { return resolveRef(p); })
        .filter(function(p) { return p.in === location; })
        .map(function(p) {
          var s = resolveRef(p.schema) || {};
          return {
            key: p.name,
            type: s.type || p.type || 'string',
            format: s.format || p.format,
            required: p.required || false,
            description: p.description || '',
            default: s.default !== undefined ? s.default : p.default,
            enum: s.enum || p.enum,
          };
        });
    }

    function getBodySchema(ep) {
      if (!ep.requestBody) return [];
      var rb = resolveRef(ep.requestBody);
      var content = rb.content;
      if (!content) return [];
      var json = content['application/json'] || content['application/x-www-form-urlencoded'];
      if (!json || !json.schema) return [];
      return getSchemaFields(json.schema);
    }

    function getResponseSchema(ep) {
      var resp = ep.responses['200'] || ep.responses['201'] || ep.responses['2XX'];
      if (!resp) return [];
      resp = resolveRef(resp);
      if (!resp.content) {
        if (resp.schema) return getSchemaFields(resp.schema);
        return [];
      }
      var json = resp.content['application/json'];
      if (!json || !json.schema) return [];
      return getSchemaFields(json.schema);
    }

    function renderParamRow(p) {
      var html = '<div class="param-row">';
      html += '<span class="param-name">' + esc(p.key) + '</span>';
      html += '<span class="param-type">' + esc(p.type) + (p.format ? ' &lt;' + esc(p.format) + '&gt;' : '') + '</span>';
      if (p.required) html += '<span class="param-required">required</span>';
      if (p.default !== undefined && p.default !== null) html += '<span class="param-default">Default: ' + esc(String(p.default)) + '</span>';
      if (p.description) html += '<div class="param-desc">' + esc(p.description) + '</div>';
      if (p.enum && p.enum.length) {
        html += '<div class="param-enum">';
        p.enum.forEach(function(v) { html += '<span class="param-enum-val">' + esc(v) + '</span>'; });
        html += '</div>';
      }
      if (p.properties && p.properties.length) {
        html += '<div class="param-nested">';
        p.properties.forEach(function(np) { html += renderParamRow(np); });
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    function renderParamSection(title, params) {
      if (!params || !params.length) return '';
      var html = '<div class="param-section"><h3>' + esc(title) + '</h3><div class="param-table">';
      params.forEach(function(p) { html += renderParamRow(p); });
      html += '</div></div>';
      return html;
    }

    function renderSchemaFields(fields) {
      if (!fields || !fields.length) return '';
      var html = '';
      fields.forEach(function(f) {
        html += '<div class="schema-field">';
        html += '<span class="schema-field-name">' + esc(f.key) + '</span>';
        html += '<span class="schema-field-type">' + esc(f.type) + (f.format ? ' &lt;' + esc(f.format) + '&gt;' : '') + '</span>';
        if (f.required) html += '<span class="schema-field-required">required</span>';
        if (f.description) html += '<span class="schema-field-desc">— ' + esc(f.description) + '</span>';
        html += '</div>';
      });
      return html;
    }

    function generateExample(fields) {
      var obj = {};
      (fields || []).forEach(function(f) {
        if (f.type === 'string') obj[f.key] = f.format === 'date-time' ? '2025-01-01T00:00:00Z' : 'example_' + f.key;
        else if (f.type === 'integer' || f.type === 'number') obj[f.key] = 0;
        else if (f.type === 'boolean') obj[f.key] = true;
        else if (f.type === 'array') obj[f.key] = [];
        else if (f.type === 'object') obj[f.key] = f.properties ? generateExample(f.properties) : {};
        else obj[f.key] = null;
      });
      return obj;
    }

    function genCurl(method, url, body) {
      var lines = ['curl --request ' + method + ' \\\\'];
      lines.push("     --url '" + url + "' \\\\");
      lines.push("     --header 'accept: application/json' \\\\");
      lines.push("     --header 'content-type: application/json'");
      if (body) {
        lines[lines.length - 1] += ' \\\\';
        lines.push("     --data '");
        lines.push(JSON.stringify(body, null, 2));
        lines.push("'");
      }
      return lines.join('\\n');
    }

    function genNode(method, url, body) {
      var lines = ['const options = {'];
      lines.push("  method: '" + method + "',");
      lines.push('  headers: {');
      lines.push("    accept: 'application/json',");
      lines.push("    'content-type': 'application/json'");
      lines.push('  }' + (body ? ',' : ''));
      if (body) lines.push('  body: JSON.stringify(' + JSON.stringify(body, null, 4).split('\\n').join('\\n  ') + ')');
      lines.push('};');
      lines.push('');
      lines.push("fetch('" + url + "', options)");
      lines.push('  .then(res => res.json())');
      lines.push('  .then(json => console.log(json));');
      return lines.join('\\n');
    }

    function genPython(method, url, body) {
      var lines = ['import requests'];
      lines.push('');
      lines.push('url = "' + url + '"');
      lines.push('headers = {');
      lines.push('    "accept": "application/json",');
      lines.push('    "content-type": "application/json"');
      lines.push('}');
      if (body) {
        lines.push('');
        lines.push('payload = ' + JSON.stringify(body, null, 4));
        lines.push('');
        lines.push('response = requests.' + method.toLowerCase() + '(url, json=payload, headers=headers)');
      } else {
        lines.push('');
        lines.push('response = requests.' + method.toLowerCase() + '(url, headers=headers)');
      }
      lines.push('print(response.json())');
      return lines.join('\\n');
    }

    function renderCodeBlock(code) {
      var lines = code.split('\\n');
      var html = '<div class="code-block"><div class="code-block-header">';
      html += '<button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest(\\'.code-block\\').querySelector(\\'code\\').textContent)">Copy</button>';
      html += '</div><pre><code>';
      lines.forEach(function(line, i) {
        html += '<div class="code-line"><span class="code-line-num">' + (i + 1) + '</span><span>' + esc(line) + '</span></div>';
      });
      html += '</code></pre></div>';
      return html;
    }

    function render() {
      var endpoints = getEndpoints();
      var info = getInfo();
      var baseUrl = getBaseUrl();
      var authType = getAuthType();
      var tagged = groupByTag(endpoints);
      var app = document.getElementById('app');

      // Sidebar
      var sidebar = '<div class="sidebar">';
      sidebar += '<div class="sidebar-header">';
      sidebar += '<div class="sidebar-title">' + esc(info.title) + '</div>';
      if (info.version) sidebar += '<div class="sidebar-version">v' + esc(info.version) + '</div>';
      sidebar += '</div>';

      // Overview link
      sidebar += '<div class="sidebar-section">';
      sidebar += '<button class="sidebar-item' + (currentEndpointIdx === -1 ? ' active' : '') + '" onclick="selectEndpoint(-1)">Overview</button>';
      sidebar += '</div>';

      // Grouped endpoints
      var epIdx = 0;
      tagged.order.forEach(function(tag) {
        sidebar += '<div class="sidebar-section">';
        sidebar += '<div class="sidebar-section-title">' + esc(tag) + '</div>';
        tagged.groups[tag].forEach(function(ep) {
          var idx = endpoints.indexOf(ep);
          sidebar += '<button class="sidebar-item' + (currentEndpointIdx === idx ? ' active' : '') + '" onclick="selectEndpoint(' + idx + ')">';
          sidebar += '<span class="method-badge ' + METHOD_COLORS[ep.method] + '">' + ep.method + '</span>';
          sidebar += '<span class="sidebar-item-label">' + esc(ep.summary || ep.path) + '</span>';
          sidebar += '</button>';
        });
        sidebar += '</div>';
      });

      sidebar += '<div class="powered-by">Powered by <a href="https://specway.com" target="_blank">Specway</a></div>';
      sidebar += '</div>';

      // Main
      var main = '<div class="main">';

      if (currentEndpointIdx === -1) {
        // Overview page
        main += '<div class="content"><div class="content-inner">';
        main += '<div class="overview-header">';
        main += '<div class="overview-title">' + esc(info.title) + '</div>';
        if (info.description) main += '<div class="overview-desc">' + esc(info.description) + '</div>';
        main += '<div class="overview-meta">';
        if (info.version) main += '<div class="overview-meta-item"><strong>Version:</strong> ' + esc(info.version) + '</div>';
        main += '<div class="overview-meta-item"><strong>Base URL:</strong> ' + esc(baseUrl) + '</div>';
        main += '<div class="overview-meta-item"><strong>Auth:</strong> ' + esc(authType) + '</div>';
        main += '<div class="overview-meta-item"><strong>Endpoints:</strong> ' + endpoints.length + '</div>';
        main += '</div></div>';

        main += '<div class="overview-endpoints-title">Endpoints</div>';
        endpoints.forEach(function(ep, idx) {
          main += '<button class="overview-endpoint" onclick="selectEndpoint(' + idx + ')">';
          main += '<span class="method-badge ' + METHOD_COLORS[ep.method] + '">' + ep.method + '</span>';
          main += '<div class="overview-ep-info">';
          main += '<div class="overview-ep-label">' + esc(ep.summary || ep.operationId) + '</div>';
          main += '<div class="overview-ep-path">' + esc(ep.path) + '</div>';
          if (ep.description) main += '<div class="overview-ep-desc">' + esc(ep.description) + '</div>';
          main += '</div></button>';
        });

        main += '</div></div>';
      } else {
        // Endpoint detail
        var ep = endpoints[currentEndpointIdx];
        var fullUrl = baseUrl + ep.path;
        var pathParams = getParams(ep, 'path');
        var queryParams = getParams(ep, 'query');
        var bodyParams = getBodySchema(ep);
        var responseFields = getResponseSchema(ep);

        // Content
        main += '<div class="content"><div class="content-inner">';
        main += '<div class="endpoint-header">';
        main += '<span class="method-badge ' + METHOD_COLORS[ep.method] + '">' + ep.method + '</span>';
        main += '<div>';
        main += '<div class="endpoint-title">' + esc(ep.summary || ep.operationId);
        if (ep.deprecated) main += '<span class="deprecated-badge">Deprecated</span>';
        main += '</div>';
        main += '<div class="endpoint-url">' + esc(fullUrl) + '</div>';
        main += '</div></div>';

        if (ep.description) main += '<div class="endpoint-description">' + esc(ep.description) + '</div>';

        main += '<div class="auth-info"><span class="auth-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' + esc(authType) + '</span></div>';

        main += renderParamSection('Path Parameters', pathParams);
        main += renderParamSection('Query Parameters', queryParams);
        main += renderParamSection('Request Body', bodyParams);

        // Responses
        if (responseFields.length) {
          main += '<div class="response-section"><h3>Responses</h3>';
          main += '<div class="response-block">';
          main += '<button class="response-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\\'none\\'?\\'block\\':\\'none\\'">';
          main += '<span class="response-dot success"></span>';
          main += '<span class="response-status">200</span>';
          main += '<span class="response-label">Success</span>';
          main += '</button>';
          main += '<div class="response-body">';
          main += '<div class="response-schema"><div class="response-schema-title">Schema</div>';
          main += renderSchemaFields(responseFields);
          main += '</div></div></div></div>';
        }

        main += '</div></div>';

        // Code panel
        var hasBody = bodyParams.length > 0 && ['POST','PUT','PATCH'].indexOf(ep.method) !== -1;
        var bodyObj = hasBody ? generateExample(bodyParams) : null;
        var codeExamples = {
          shell: genCurl(ep.method, fullUrl, bodyObj),
          node: genNode(ep.method, fullUrl, bodyObj),
          python: genPython(ep.method, fullUrl, bodyObj),
        };

        main += '<div class="code-panel">';
        main += '<div class="code-section-title">Language</div>';
        main += '<div class="lang-tabs">';
        LANGS.forEach(function(lang) {
          main += '<button class="lang-tab' + (selectedLang === lang.id ? ' active' : '') + '" onclick="setLang(\\'' + lang.id + '\\')">';
          main += '<span class="lang-tab-icon">' + lang.icon + '</span>';
          main += '<span>' + lang.label + '</span>';
          main += '</button>';
        });
        main += '</div>';

        main += '<div class="code-section-title">Request</div>';
        main += renderCodeBlock(codeExamples[selectedLang]);

        if (responseFields.length) {
          main += '<div class="example-section">';
          main += '<div class="code-section-title">Example Response</div>';
          main += renderCodeBlock(JSON.stringify(generateExample(responseFields), null, 2));
          main += '</div>';
        }

        main += '</div>';
      }

      main += '</div>';
      app.innerHTML = sidebar + main;
    }

    window.selectEndpoint = function(idx) {
      currentEndpointIdx = idx;
      render();
    };

    window.setLang = function(lang) {
      selectedLang = lang;
      render();
    };

    window.updateSpec = function(newSpec) {
      spec = newSpec;
      render();
    };

    render();

    // SSE hot-reload
    var evtSource = new EventSource('/__sse');
    evtSource.addEventListener('reload', function(e) {
      spec = JSON.parse(e.data);
      render();
    });
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
