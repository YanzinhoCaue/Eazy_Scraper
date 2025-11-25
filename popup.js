const statusEl = document.getElementById('status');
const listEl = document.getElementById('list');

function render(items = []) {
  listEl.innerHTML = '';
  const displayItems = items.slice(-5).reverse(); 
  
  if (items.length > 0) {
    listEl.innerHTML = `<div style="padding:5px; color:#00B294; font-size:12px; font-weight:bold">Últimos ${displayItems.length} capturados (Total: ${items.length}):</div>`;
  } else {
    listEl.innerHTML = `<div style="padding:20px; color:#777; font-size:13px;">Lista vazia.<br>Pronto para começar.</div>`;
  }

  displayItems.forEach(it => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <h3>${it.titulo || 'Sem título'}</h3>
      <div class="meta"><b>Empresa:</b> ${it.empresa || '-'}</div>
      <div class="kv"><b>Pagamento:</b> ${it.pagamento || '-'}</div>
    `;
    listEl.appendChild(div);
  });
}

async function loadFromStorage() {
  const result = await chrome.storage.local.get('vagasColetadas');
  const vagas = result.vagasColetadas || [];
  render(vagas);
  return vagas;
}

// --- BOTÕES ---

// INICIAR
document.getElementById('start').addEventListener('click', async () => {
  statusEl.textContent = 'Injetando script...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
});

// PARAR
document.getElementById('stop').addEventListener('click', async () => {
  statusEl.textContent = 'Enviando sinal de PARAR...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: 'stop-scraping' }).catch(err => {
      statusEl.textContent = 'Erro: O scraper não parece estar rodando.';
    });
  }
});

// LIMPAR LISTA (O que você pediu)
document.getElementById('clear').addEventListener('click', async () => {
  // Pergunta antes para evitar acidente
  if (confirm("Tem certeza que deseja apagar todas as vagas salvas da memória?")) {
    await chrome.storage.local.remove('vagasColetadas');
    render([]); // Força a lista a ficar vazia visualmente
    statusEl.textContent = 'Memória limpa com sucesso.';
  }
});

// EXPORTAR
document.getElementById('csv').addEventListener('click', async () => {
  const data = await loadFromStorage();
  if(!data.length) return alert('A lista está vazia! Nada para exportar.');
  download('vagas_TOTAL_ACUMULADO.csv', toCSV(data), 'text/csv;charset=utf-8');
});

document.getElementById('json').addEventListener('click', async () => {
  const data = await loadFromStorage();
  if(!data.length) return alert('A lista está vazia! Nada para exportar.');
  download('vagas_TOTAL_ACUMULADO.json', JSON.stringify(data, null, 2), 'application/json');
});

// Funções Auxiliares
function toCSV(items) {
  const header = ['titulo','empresa','pagamento','telefone','email','site'];
  const rows = items.map(it => header.map(h => `"${(it[h] || '').replace(/"/g,'""')}"`).join(','));
  return [header.join(','), ...rows].join('\n');
}

function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

// Escuta mensagens automáticas (Update ao terminar lote)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'scrape-complete') {
    statusEl.textContent = `Lote salvo! Total Geral: ${msg.count}`;
    loadFromStorage();
  }
  if (msg?.type === 'scrape-stopped') {
    statusEl.textContent = `Operação Parada pelo Usuário.`;
  }
});

// Carrega inicial
loadFromStorage();