(async function() {
  // Variável de controle global para este escopo
  let stopRequested = false;

  // OUVINTE DE MENSAGENS (Para receber o comando de PARAR do popup)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'stop-scraping') {
      console.log('[Scraper] Pedido de parada recebido!');
      stopRequested = true;
    }
  });

  const BATCH_SIZE = 50; 
  const DELAY_LOAD = 3000;
  const DELAY_CLICK = 1000;
  const delay = ms => new Promise(res => setTimeout(res, ms));

  const findLoadMoreBtn = () => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => {
      const txt = b.innerText.toLowerCase();
      return txt.includes('load more') || txt.includes('carregar mais') || (txt.includes('carregar') && !txt.includes('error'));
    });
  };

  // 1. Preenche a tela
  async function ensureItems() {
    let currentCards = document.querySelectorAll('article.cursor-pointer');
    let attempts = 0;
    console.log(`[Scraper] Vagas na tela: ${currentCards.length}. Meta: ${BATCH_SIZE}`);

    while (currentCards.length < BATCH_SIZE && attempts < 15) {
      if (stopRequested) return; // Para se solicitado

      const btn = findLoadMoreBtn();
      if (btn) {
        btn.click();
        await delay(DELAY_LOAD);
        currentCards = document.querySelectorAll('article.cursor-pointer');
      } else {
        break;
      }
      attempts++;
    }
  }

  // 2. Processa o lote
  async function processBatch() {
    const cards = Array.from(document.querySelectorAll('article.cursor-pointer'));
    const batchCards = cards.slice(0, BATCH_SIZE); 
    
    if (batchCards.length === 0) {
      alert("Não há vagas visíveis.");
      return;
    }

    console.log(`[Scraper] Iniciando lote de ${batchCards.length}...`);
    const extractedData = [];

    for (let i = 0; i < batchCards.length; i++) {
      // --- PONTO DE PARADA ---
      if (stopRequested) {
        console.warn('[Scraper] Parando loop imediatamente.');
        chrome.runtime.sendMessage({ type: 'scrape-stopped' });
        alert(`Processo interrompido!\n\nForam coletadas ${extractedData.length} vagas neste lote antes de parar.\nElas serão salvas.`);
        break; // Quebra o loop
      }

      try {
        const card = batchCards[i];
        card.scrollIntoView({ behavior: 'auto', block: 'center' });
        card.click();
        await delay(DELAY_CLICK);

        const detailContainer = document.getElementById('job-detail');

        if (detailContainer) {
          const titleEl = detailContainer.querySelector('h2');
          const title = titleEl ? titleEl.innerText.trim() : 'Sem Título';

          let company = '';
          const companyContainer = detailContainer.querySelector('.text-gray-500');
          if (companyContainer) company = companyContainer.innerText.split('\n')[0];

          const telLink = detailContainer.querySelector('a[href^="tel:"]');
          const phone = telLink ? telLink.innerText.replace('tel:', '').trim() : '';

          const mailLink = detailContainer.querySelector('a[href^="mailto:"]');
          const email = mailLink ? mailLink.innerText.trim() : '';

          const fullText = detailContainer.innerText;
          const payMatch = fullText.match(/(US\$\s?|\$\s?)\d+([.,]\d{2})?(\s+por\s+hora|\s+per\s+hour)?/i);
          const pay = payMatch ? payMatch[0] : '';

          let site = '';
          const allLinks = Array.from(detailContainer.querySelectorAll('a[href^="http"]'));
          const validLink = allLinks.find(a => 
              !a.href.includes('facebook') && !a.href.includes('twitter') && 
              !a.href.includes('linkedin') && !a.href.includes('seasonaljobs.dol.gov')
          );
          if (validLink) site = validLink.href;

          extractedData.push({ titulo: title, empresa: company, telefone: phone, email: email, site: site, pagamento: pay });
        }

        // Remove da tela (só remove se não foi cancelado antes, mas aqui já passou o check)
        card.remove();

      } catch (err) {
        console.error("Erro:", err);
      }
    }

    // Envia o que conseguiu pegar (mesmo se parou no meio)
    if (extractedData.length > 0) {
      chrome.runtime.sendMessage({ type: 'scrape-batch-data', payload: extractedData }, () => {
        // Se parou, não mostra o alerta de "finalizado com sucesso", o alert de parada já foi
        if (!stopRequested) {
            setTimeout(() => {
                alert(`Lote finalizado!\n\nBaixado CSV com ${extractedData.length} vagas.\n\nClique em "Iniciar" novamente para o próximo.`);
            }, 1000);
        }
      });
    }
  }

  // Reset de segurança ao iniciar (se recarregar o script)
  stopRequested = false;
  
  await ensureItems();
  if (!stopRequested) {
      await processBatch();
  } else {
      alert('Parado antes de processar os itens.');
  }

})();