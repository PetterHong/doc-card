import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', '..', 'data');
const REGISTRY_FILE = join(DATA_DIR, 'files.json');

function ensureRegistry() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(REGISTRY_FILE)) writeFileSync(REGISTRY_FILE, '[]', 'utf-8');
}

function readRegistry() {
  ensureRegistry();
  try {
    const raw = readFileSync(REGISTRY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRegistry(items) {
  ensureRegistry();
  writeFileSync(REGISTRY_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileTypeInfo(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.docx' || ext === '.doc') return { kind: 'word', label: 'Word', badge: 'W' };
  if (ext === '.pdf') return { kind: 'pdf', label: 'PDF', badge: 'PDF' };
  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') return { kind: 'excel', label: 'Excel', badge: 'X' };
  if (ext === '.pptx' || ext === '.ppt') return { kind: 'ppt', label: 'PowerPoint', badge: 'P' };
  if (ext === '.md' || ext === '.txt') return { kind: 'text', label: '文档', badge: 'T' };
  return { kind: 'other', label: ext.replace('.', '').toUpperCase() || '文件', badge: 'F' };
}

function enrichFiles() {
  const list = readRegistry();
  return list.map((item) => {
    const fullPath = resolve(String(item.path || ''));
    const exists = Boolean(item.path) && existsSync(fullPath);
    let size = '';
    let mtime = item.addedAt || '';
    if (exists) {
      try {
        const st = statSync(fullPath);
        size = formatBytes(st.size);
        mtime = st.mtime.toLocaleString('zh-CN', { hour12: false });
      } catch {}
    }
    const type = fileTypeInfo(fullPath);
    return {
      path: fullPath,
      dir: dirname(fullPath),
      name: basename(fullPath),
      note: item.note || '',
      exists,
      size,
      mtime,
      ...type,
    };
  });
}

function assertRegisteredExisting(targetPath) {
  const resolved = resolve(String(targetPath || ''));
  const list = readRegistry();
  const matched = list.some((it) => resolve(String(it.path || '')).toLowerCase() === resolved.toLowerCase());
  if (!matched) {
    throw new Error('该文件不在已登记文档列表中');
  }
  if (!existsSync(resolved)) {
    throw new Error('文件不存在或已被移动');
  }
  return resolved;
}

function openWithDefaultApp(filePath) {
  return new Promise((res, rej) => {
    if (process.platform === 'win32') {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process -FilePath $env:DOC_CARD_TARGET'],
        { env: { ...process.env, DOC_CARD_TARGET: filePath }, windowsHide: true },
        (err) => (err ? rej(new Error('默认软件打开失败，请确认本机已关联该文件类型')) : res({ ok: true }))
      );
    } else if (process.platform === 'darwin') {
      execFile('open', [filePath], (err) => (err ? rej(err) : res({ ok: true })));
    } else {
      execFile('xdg-open', [filePath], (err) => (err ? rej(err) : res({ ok: true })));
    }
  });
}

function revealInExplorer(filePath) {
  return new Promise((res, rej) => {
    if (process.platform === 'win32') {
      execFile('explorer.exe', [`/select,${filePath}`], { windowsHide: false }, () => {
        // explorer.exe often exits with code 1 even on success
        res({ ok: true });
      });
    } else if (process.platform === 'darwin') {
      execFile('open', ['-R', filePath], (err) => (err ? rej(err) : res({ ok: true })));
    } else {
      execFile('xdg-open', [dirname(filePath)], (err) => (err ? rej(err) : res({ ok: true })));
    }
  });
}

function copyToDesktop(filePath) {
  const desktopDir = join(homedir(), 'Desktop');
  if (!existsSync(desktopDir)) mkdirSync(desktopDir, { recursive: true });
  const dest = join(desktopDir, basename(filePath));
  copyFileSync(filePath, dest);
  return { ok: true, desktopPath: dest };
}

const UI_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>文档卡片助手</title>
  <style>
    :root {
      --bg: #f4f6fa;
      --surface: #ffffff;
      --surface-hover: #f8fafc;
      --border: #e2e8f0;
      --border-strong: #cbd5e1;
      --fg: #0f172a;
      --muted: #64748b;
      --accent: #2563eb;
      --accent-soft: rgba(37, 99, 235, 0.10);
      --menu-bg: #ffffff;
      --shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
      --menu-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #14161a;
        --surface: #1e2128;
        --surface-hover: #262a33;
        --border: #2e3340;
        --border-strong: #3e4556;
        --fg: #f1f5f9;
        --muted: #94a3b8;
        --accent: #3b82f6;
        --accent-soft: rgba(59, 130, 246, 0.16);
        --menu-bg: #242832;
        --shadow: 0 2px 12px rgba(0, 0, 0, 0.30);
        --menu-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px;
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      font-size: 13px;
      line-height: 1.45;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    .header-title {
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-sub {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 2px;
    }
    .btn-refresh {
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--fg);
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-refresh:hover { background: var(--surface-hover); }
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      box-shadow: var(--shadow);
      position: relative;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;
    }
    .card:hover {
      border-color: var(--accent);
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.12);
    }
    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .file-main {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
      cursor: pointer;
    }
    .icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      flex-shrink: 0;
    }
    .icon.word { background: rgba(37, 99, 235, 0.12); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.25); }
    .icon.pdf { background: rgba(220, 38, 38, 0.12); color: #dc2626; border: 1px solid rgba(220, 38, 38, 0.25); }
    .icon.excel { background: rgba(22, 163, 74, 0.12); color: #16a34a; border: 1px solid rgba(22, 163, 74, 0.25); }
    .icon.ppt { background: rgba(234, 88, 12, 0.12); color: #ea580c; border: 1px solid rgba(234, 88, 12, 0.25); }
    .icon.text, .icon.other { background: var(--accent-soft); color: var(--accent); border: 1px solid var(--border); }
    .meta { min-width: 0; flex: 1; }
    .fname {
      font-weight: 650;
      font-size: 13.5px;
      color: var(--fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .submeta {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 2px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .dropdown-wrap { position: relative; flex-shrink: 0; }
    .btn-open-menu {
      border: 1px solid var(--border-strong);
      background: var(--surface-hover);
      color: var(--fg);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .btn-open-menu:hover { border-color: var(--accent); color: var(--accent); }
    .menu {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      width: 210px;
      background: var(--menu-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--menu-shadow);
      padding: 6px;
      z-index: 50;
      display: none;
    }
    .menu.open { display: block; }
    .menu-item {
      width: 100%;
      border: none;
      background: transparent;
      color: var(--fg);
      text-align: left;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 12.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .menu-item:hover { background: var(--accent-soft); }
    .menu-sep { height: 1px; background: var(--border); margin: 4px 6px; }
    .path-row {
      margin-top: 9px;
      padding-top: 8px;
      border-top: 1px dashed var(--border);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 11px;
      color: var(--muted);
      word-break: break-all;
    }
    .quick-bar {
      margin-top: 8px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .qbtn {
      border: 1px solid var(--border);
      background: var(--surface-hover);
      color: var(--fg);
      border-radius: 7px;
      padding: 4px 9px;
      font-size: 11.5px;
      cursor: pointer;
    }
    .qbtn.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #ffffff;
    }
    .qbtn:hover { opacity: 0.9; }
    .missing { color: #dc2626; font-weight: 600; }
    .empty {
      text-align: center;
      padding: 36px 16px;
      color: var(--muted);
      background: var(--surface);
      border: 1px dashed var(--border-strong);
      border-radius: 12px;
    }
    .toast {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      max-width: calc(100% - 28px);
      background: #0f172a;
      color: #ffffff;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 12px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.25);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
      z-index: 100;
      word-break: break-word;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">📂 文档卡片助手</div>
      <div class="header-sub">点击卡片或「打开方式」直接用默认软件打开 / 定位资源管理器</div>
    </div>
    <button class="btn-refresh" onclick="loadFiles()">刷新</button>
  </div>
  <div id="list" class="list"></div>
  <div id="toast" class="toast"></div>

  <script>
    let filesCache = [];
    let openMenuIdx = null;

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
    }

    async function postApi(url, body) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || '操作失败');
      return data;
    }

    async function doAction(action, idx) {
      const item = filesCache[idx];
      if (!item) return;
      closeMenus();
      try {
        if (action === 'open') {
          await postApi('/api/open-default', { path: item.path });
          showToast('已使用默认软件打开');
        } else if (action === 'reveal') {
          await postApi('/api/reveal', { path: item.path });
          showToast('已在文件资源管理器中定位');
        } else if (action === 'desktop') {
          await postApi('/api/copy-desktop', { path: item.path });
          showToast('已复制到桌面 ✓');
        } else if (action === 'copy') {
          await navigator.clipboard.writeText(item.path);
          showToast('已复制完整路径 ✓');
        }
      } catch (err) {
        showToast('失败：' + (err.message || err));
      }
    }

    function closeMenus() {
      openMenuIdx = null;
      document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
    }

    function toggleMenu(ev, idx) {
      ev.stopPropagation();
      const target = document.getElementById('menu-' + idx);
      const wasOpen = target.classList.contains('open');
      closeMenus();
      if (!wasOpen) {
        target.classList.add('open');
        openMenuIdx = idx;
      }
    }

    document.addEventListener('click', closeMenus);

    function esc(s) {
      return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function render() {
      const box = document.getElementById('list');
      if (!filesCache.length) {
        box.innerHTML = '<div class="empty">暂无已登记的文档。<br/>产出 Word / PDF / Excel 文档后将自动显示在这里。</div>';
        return;
      }
      box.innerHTML = filesCache.map((f, i) => \`
        <div class="card" title="点击使用默认软件打开" onclick="doAction('open', \${i})">
          <div class="card-top">
            <div class="file-main">
              <div class="icon \${esc(f.kind)}">\${esc(f.badge)}</div>
              <div class="meta">
                <div class="fname">\${esc(f.name)}</div>
                <div class="submeta">
                  <span>\${esc(f.label)}</span>
                  \${f.exists ? \`<span>· \${esc(f.size)}</span>\` : '<span class="missing">· 文件不存在</span>'}
                  \${f.note ? \`<span>· \${esc(f.note)}</span>\` : ''}
                </div>
              </div>
            </div>
            <div class="dropdown-wrap" onclick="event.stopPropagation()">
              <button class="btn-open-menu" onclick="toggleMenu(event, \${i})">打开方式 ▾</button>
              <div id="menu-\${i}" class="menu" onclick="event.stopPropagation()">
                <button class="menu-item" onclick="doAction('open', \${i})">📄 默认软件打开 (Default app)</button>
                <button class="menu-item" onclick="doAction('reveal', \${i})">📁 在文件资源管理器中显示</button>
                <div class="menu-sep"></div>
                <button class="menu-item" onclick="doAction('desktop', \${i})">🖥️ 复制一份到桌面</button>
                <button class="menu-item" onclick="doAction('copy', \${i})">📋 复制完整路径</button>
              </div>
            </div>
          </div>
          <div class="quick-bar" onclick="event.stopPropagation()">
            <button class="qbtn primary" onclick="doAction('open', \${i})">默认软件打开</button>
            <button class="qbtn" onclick="doAction('reveal', \${i})">打开资源管理器</button>
            <button class="qbtn" onclick="doAction('desktop', \${i})">复制到桌面</button>
          </div>
          <div class="path-row">\${esc(f.path)}</div>
        </div>
      \`).join('');
    }

    async function loadFiles() {
      try {
        const res = await fetch('/api/files');
        const data = await res.json();
        filesCache = Array.isArray(data.files) ? data.files : [];
        render();
      } catch (e) {
        showToast('加载列表失败');
      }
    }

    loadFiles();
    setInterval(() => { if (openMenuIdx === null) loadFiles(); }, 4000);
  </script>
</body>
</html>`;

if (process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
  const { SidecarApp } = await import('sidecar_sdk');
  const app = new SidecarApp();

  app.page('/', () => UI_HTML);
  app.api('/api/files', () => ({ files: enrichFiles() }), 'GET');

  app.api('/api/open-default', async (data) => {
    try {
      const target = assertRegisteredExisting(data?.path);
      return await openWithDefaultApp(target);
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  }, 'POST');

  app.api('/api/reveal', async (data) => {
    try {
      const target = assertRegisteredExisting(data?.path);
      return await revealInExplorer(target);
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  }, 'POST');

  app.api('/api/copy-desktop', async (data) => {
    try {
      const target = assertRegisteredExisting(data?.path);
      return copyToDesktop(target);
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  }, 'POST');

  app.api('/api/remove', async (data) => {
    const target = resolve(String(data?.path || '')).toLowerCase();
    const list = readRegistry().filter((it) => resolve(String(it.path || '')).toLowerCase() !== target);
    writeRegistry(list);
    return { ok: true };
  }, 'POST');

  app.run();

  // Auto-reload when server.mjs is updated (host restarts process under restart_policy: always)
  try {
    let reloading = false;
    watch(__dirname, (_evt, filename) => {
      if (reloading || !filename || !filename.endsWith('.mjs')) return;
      reloading = true;
      setTimeout(() => process.exit(0), 250);
    });
  } catch {}
}
