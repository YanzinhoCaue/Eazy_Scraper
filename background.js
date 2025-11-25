// Função auxiliar para criar o texto do CSV
function createCSVContent(items) {
  const header = ['titulo', 'empresa', 'pagamento', 'telefone', 'email', 'site'];
  const rows = items.map(it => 
    header.map(h => `"${(it[h] || '').replace(/"/g, '""')}"`).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  // Repassa progresso
  if (msg?.type === 'scrape-progress') {
    chrome.runtime.sendMessage(msg).catch(()=>{});
    sendResponse({ ok: true });
    return true;
  }

  // Recebe LOTE e baixa
  if (msg?.type === 'scrape-batch-data') {
    const newItems = msg.payload || [];
    
    // Salva no storage (backup)
    chrome.storage.local.get('vagasColetadas', (result) => {
      const existingItems = result.vagasColetadas || [];
      const allItems = [...existingItems, ...newItems];
      chrome.storage.local.set({ vagasColetadas: allItems });
    });

    // GERA O CSV COM "BOM" (Para acentuação correta no Excel/Sheets)
    try {
      let csvContent = createCSVContent(newItems);
      
      // --- AQUI ESTÁ O TRUQUE ---
      // Adiciona o caractere invisível BOM (\uFEFF) no início
      // Isso força o Excel/Sheets a reconhecer acentos corretamente
      const bom = '\uFEFF'; 
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
      
      // Converte para Base64 para o sistema de downloads do Chrome
      const reader = new FileReader();
      reader.onload = function(e) {
        const url = e.target.result; // Data URL base64 direto do Blob
        
        const date = new Date();
        const timeStr = `${date.getHours()}h${date.getMinutes()}m`;
        const filename = `vagas_lote_${newItems.length}_${timeStr}.csv`;

        chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: false
        }, () => {
           // Avisa o popup que terminou
          chrome.runtime.sendMessage({ type: 'scrape-complete', count: newItems.length }).catch(()=>{});
        });
      };
      reader.readAsDataURL(blob);

    } catch (e) {
      console.error("Erro CSV:", e);
    }

    sendResponse({ ok: true });
    return true;
  }
});