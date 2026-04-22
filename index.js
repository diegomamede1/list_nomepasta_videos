const BASE = 'https://api-v2.pandavideo.com.br';

let dadosExport = [];

function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = isError ? 'status error' : 'status';
}

async function fetchAll(apiKey, path, params = {}) {
  const todos = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const url = new URL(BASE + path);
    url.searchParams.set('page', page);
    url.searchParams.set('limit', limit);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url, {
      headers: { Authorization: apiKey }
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }

    const data = await res.json();

    const items = Array.isArray(data) ? data
      : data.videos ?? data.folders ?? data.data ?? data.items ?? [];

    todos.push(...items);

    const total = data.total ?? data.count ?? null;
    if (total !== null && todos.length >= total) break;
    if (items.length < limit) break;
    page++;
  }

  return todos;
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toGB(bytes) {
  if (!bytes) return '0 GB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function renderFolderCard(folderId, folderName, videos) {
  const block = document.createElement('div');
  block.className = 'folder-block';

  const isRoot = folderId === '__root__';
  const idSpan = isRoot ? '' : `<span class="folder-id">${escHtml(folderId)}</span>`;
  const totalBytes = videos.reduce((acc, v) => acc + (v.storage_size ?? 0), 0);

  block.innerHTML = `
    <div class="folder-header">
      <span class="folder-name">${escHtml(folderName)}</span>
      ${idSpan}
      <span class="folder-size">${toGB(totalBytes)}</span>
    </div>
    <div class="video-list">
      ${videos.map(v => `
        <div class="video-item">
          <span class="video-id">${escHtml(v.id)}</span>
          <span class="video-size">${toGB(v.storage_size)}</span>
        </div>
      `).join('')}
    </div>
  `;

  return block;
}

async function buscar() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) { setStatus('Informe a API key.', true); return; }

  const btn = document.getElementById('btnBuscar');
  btn.disabled = true;
  document.getElementById('results').innerHTML = '';
  document.getElementById('stats').style.display = 'none';
  document.getElementById('btnExportWrapper').style.display = 'none';
  dadosExport = [];

  try {
    setStatus('Buscando vídeos...');
    const videos = await fetchAll(apiKey, '/videos');

    setStatus(`${videos.length} vídeo(s) encontrado(s). Buscando pastas...`);

    let folderMap = {};
    const groups = {};

    for (const v of videos) {
      const fid = v.folder_id ?? '__root__';
      if (!groups[fid]) groups[fid] = [];
      groups[fid].push(v);

      if (fid !== '__root__' && !folderMap[fid]) {
        folderMap[fid] =
          v.folder_name ??
          v.folder?.name ??
          v.folder?.title ??
          v.folder?.folder_name ??
          null;
      }
    }

    try {
      const res = await fetch('https://api-v2.pandavideo.com/folders', {
        headers: { Authorization: apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        const pastas = Array.isArray(data) ? data : data.folders ?? data.data ?? data.items ?? [];
        pastas.forEach(f => {
          folderMap[f.id] = f.name ?? f.title ?? folderMap[f.id] ?? f.id;
        });
      }
    } catch {
      // segue com o que temos
    }

    for (const fid of Object.keys(groups)) {
      if (fid !== '__root__' && !folderMap[fid]) {
        folderMap[fid] = fid;
      }
    }

    const resultsEl = document.getElementById('results');
    const folderIds = Object.keys(groups).filter(f => f !== '__root__').sort((a, b) =>
      (folderMap[a] ?? a).localeCompare(folderMap[b] ?? b)
    );

    const allGroups = [...folderIds, ...(groups['__root__'] ? ['__root__'] : [])];
    for (const fid of allGroups) {
      const name = fid === '__root__' ? 'Sem pasta' : (folderMap[fid] ?? fid);
      resultsEl.appendChild(renderFolderCard(fid, name, groups[fid]));
      for (const v of groups[fid]) {
        dadosExport.push({ folderId: fid === '__root__' ? '' : fid, folderName: name, videoId: v.id, videoSize: parseFloat((( v.storage_size ?? 0) / 1073741824).toFixed(2)) });
      }
    }

    const totalPastas = folderIds.length;
    const totalBytes = videos.reduce((acc, v) => acc + (v.storage_size ?? 0), 0);
    const totalTB = (totalBytes / 1099511627776).toFixed(3);

    document.getElementById('totalVideos').textContent = videos.length;
    document.getElementById('totalPastas').textContent = totalPastas;
    document.getElementById('totalStorage').textContent = totalTB + ' TB';
    document.getElementById('stats').style.display = 'flex';
    document.getElementById('btnExportWrapper').style.display = 'block';

    setStatus(`Concluído — ${videos.length} vídeo(s) em ${totalPastas} pasta(s).`);
  } catch (err) {
    setStatus('Erro: ' + err.message, true);
  } finally {
    btn.disabled = false;
  }
}

function exportarExcel() {
  if (!dadosExport.length) return;

  const rows = [['Pasta ID', 'Pasta Nome', 'Video ID', 'Tamanho (GB)']];
  for (const { folderId, folderName, videoId, videoSize } of dadosExport) {
    rows.push([folderId, folderName, videoId, videoSize]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Videos');
  XLSX.writeFile(wb, 'panda_videos.xlsx');
}

document.getElementById('apiKey').addEventListener('keydown', e => {
  if (e.key === 'Enter') buscar();
});
