const statusEl = document.getElementById('status');
const statusScrollEl = document.getElementById('status-scroll');
const listEl = document.getElementById('list');

function render(items = []) {
  listEl.innerHTML = '';
  const displayItems = items.slice(-5).reverse(); 
  
  if (items.length > 0) {
    listEl.innerHTML = `<div style="padding:5px; color:#00B294; font-size:12px; font-weight:bold">Últimos capturados (Total: ${items.length}):</div>`;
  } else {
    listEl.innerHTML = `<div style="padding:20px; color:#777; font-size:13px;">Lista vazia.</div>`;
  }

  displayItems.forEach(it => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <h3>${it.titulo || 'Sem título'}</h3>
      <div class="meta"><b>Empresa:</b> ${it.empresa || '-'}</div>
      <div class="kv"><b>Email:</b> ${it.email || '-'}</div>
    `;
    listEl.appendChild(div);
  });
}

async function loadFromStorage() {
  const result = await chrome.storage.local.get('vagasColetadas');
  render(result.vagasColetadas || []);
}

// --- BOTÃO NOVO: COLETAR TUDO ---
document.getElementById('scrapeAll').addEventListener('click', async () => {
  statusEl.textContent = 'Iniciando varredura total...';
  statusEl.style.color = "#db2777";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  chrome.tabs.sendMessage(tab.id, { type: 'scrape-all-loaded' });
});

// --- ROLAGEM ---
document.getElementById('btnScroll').addEventListener('click', async () => {
  const target = parseInt(document.getElementById('targetAmount').value) || 100;
  statusScrollEl.textContent = `Rolando até ${target}...`;
  statusScrollEl.style.color = "#00B294";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  chrome.tabs.sendMessage(tab.id, { type: 'scroll-only', target: target });
});

// --- OUTROS ---
document.getElementById('start').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  chrome.tabs.sendMessage(tab.id, { type: 'start-extraction' }); // Modo antigo (Lotes)
});

document.getElementById('stop').addEventListener('click', async () => {
  statusEl.textContent = 'Parando...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if(tab) chrome.tabs.sendMessage(tab.id, { type: 'stop-scraping' }).catch(()=>{});
});

document.getElementById('clear').addEventListener('click', async () => {
  if (confirm("Apagar tudo da memória?")) {
    await chrome.storage.local.remove('vagasColetadas');
    render([]); 
    statusEl.textContent = 'Memória limpa.';
  }
});

document.getElementById('csv').addEventListener('click', async () => {
  const data = (await chrome.storage.local.get('vagasColetadas')).vagasColetadas || [];
  if(!data.length) return alert('Lista vazia!');
  download('vagas_export.csv', toCSV(data), 'text/csv;charset=utf-8');
});

// --- UTILS ---
function toCSV(items) {
  const header = ['titulo','empresa','pagamento','telefone','email','site'];
  const rows = items.map(it => header.map(h => `"${(it[h] || '').replace(/"/g,'""')}"`).join(','));
  return [header.join(','), ...rows].join('\n');
}

function download(filename, text, mime) {
  const blob = new Blob(['\uFEFF'+text], { type: mime }); // Adicionei BOM para acentos
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

// MENSAGENS
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'scrape-progress') {
    statusEl.textContent = `Lendo vaga ${msg.done} de ${msg.total}...`;
  }
  if (msg?.type === 'scrape-complete') {
    statusEl.textContent = `Concluído! ${msg.count} vagas salvas.`;
    loadFromStorage();
  }
  if (msg?.type === 'scroll-update') {
    statusScrollEl.textContent = `Carregadas: ${msg.current} / ${msg.target}`;
  }
});

loadFromStorage();
