// Função CSV
function createCSVContent(items) {
  const header = ['titulo', 'empresa', 'pagamento', 'telefone', 'email', 'site'];
  const rows = items.map(it => header.map(h => `"${(it[h] || '').replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...rows].join('\n');
}

// Download Helper
function triggerDownload(items, suffix) {
  if (!items || !items.length) return;
  try {
    const csvContent = createCSVContent(items);
    const bom = '\uFEFF'; 
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
    const reader = new FileReader();
    reader.onload = function(e) {
      const url = e.target.result;
      const date = new Date();
      const timeStr = `${date.getHours()}h${date.getMinutes()}m`;
      chrome.downloads.download({ url: url, filename: `vagas_${suffix}_${timeStr}.csv`, saveAs: false });
    };
    reader.readAsDataURL(blob);
  } catch (e) { console.error(e); }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  if (msg?.type === 'scrape-progress') {
    chrome.runtime.sendMessage(msg).catch(()=>{});
  }

  // Apenas SALVA no storage (Backup silencioso)
  if (msg?.type === 'save-backup') {
    const newItems = msg.payload || [];
    chrome.storage.local.get('vagasColetadas', (result) => {
      const existingItems = result.vagasColetadas || [];
      const allItems = [...existingItems, ...newItems];
      chrome.storage.local.set({ vagasColetadas: allItems }, () => {
        console.log(`[SW] Backup salvo. Total: ${allItems.length}`);
      });
    });
  }

  // DOWNLOAD FINAL (Acionado quando acaba tudo)
  if (msg?.type === 'download-all') {
    chrome.storage.local.get('vagasColetadas', (result) => {
      const allItems = result.vagasColetadas || [];
      console.log(`[SW] Gerando CSV Final com ${allItems.length} itens.`);
      triggerDownload(allItems, 'COMPLETO');
      chrome.runtime.sendMessage({ type: 'scrape-complete', count: allItems.length }).catch(()=>{});
    });
  }
});
