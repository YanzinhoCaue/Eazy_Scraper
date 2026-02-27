(async function() {
  if (window.hasScraperInjected) return;
  window.hasScraperInjected = true;

  let stopRequested = false;
  const BASE_DELAY = 3500;
  const DELAY_CLICK = 1000;
  const MAX_RETRIES = 20;
  const DELAY_RETRY = 2000;

  const delay = ms => new Promise(res => setTimeout(res, ms));

  const findLoadMoreBtn = () => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => {
      const txt = b.innerText.toLowerCase();
      return txt.includes('load more') || txt.includes('carregar mais') || (txt.includes('carregar') && !txt.includes('error'));
    });
  };

  // --- EXTRAÇÃO DE DADOS (Função Padrão) ---
  function extractDataFromPanel(detailContainer) {
    const title = detailContainer.querySelector('h2')?.innerText.trim() || 'Sem Título';
    
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
        !a.href.includes('facebook') && !a.href.includes('twitter') && !a.href.includes('linkedin') && !a.href.includes('seasonaljobs.dol.gov')
    );
    if (validLink) site = validLink.href;

    return { titulo: title, empresa: company, telefone: phone, email: email, site: site, pagamento: pay };
  }

  // --- MODO 1: APENAS ROLAR ---
  async function scrollOnly(targetCount) {
    stopRequested = false;
    let currentCards = document.querySelectorAll('article.cursor-pointer');
    let errors = 0;
    
    while (currentCards.length < targetCount) {
      if (stopRequested) break;
      const btn = findLoadMoreBtn();
      
      if (btn) {
        errors = 0;
        btn.scrollIntoView({ behavior: 'instant', block: 'center' });
        btn.click();
        const dynDelay = BASE_DELAY + (currentCards.length * 2);
        
        chrome.runtime.sendMessage({ type: 'scroll-update', current: currentCards.length, target: targetCount }).catch(()=>{});
        console.log(`[Scraper] Carregando... (${currentCards.length} itens)`);
        
        await delay(dynDelay);
        currentCards = document.querySelectorAll('article.cursor-pointer');
      } else {
        errors++;
        console.warn(`[Scraper] Botão sumiu (${errors}/${MAX_RETRIES})`);
        window.scrollTo(0, document.body.scrollHeight);
        if (errors >= MAX_RETRIES) break;
        await delay(DELAY_RETRY);
        currentCards = document.querySelectorAll('article.cursor-pointer');
      }
    }
    chrome.runtime.sendMessage({ type: 'scroll-update', current: currentCards.length, target: targetCount }).catch(()=>{});
    if(!stopRequested) alert(`Pronto! ${currentCards.length} vagas carregadas.`);
  }

  // --- MODO 2: COLETAR TUDO (Seu pedido) ---
  async function processAllLoaded() {
    stopRequested = false;
    // Pega TUDO que está na tela agora
    const cards = Array.from(document.querySelectorAll('article.cursor-pointer'));
    
    if (cards.length === 0) return alert("Nenhuma vaga encontrada. Role a tela primeiro.");
    if (!confirm(`Existem ${cards.length} vagas carregadas. Iniciar coleta completa?`)) return;

    console.log(`[Scraper] Iniciando coleta massiva de ${cards.length} itens...`);
    
    let batchData = []; // Acumulador temporário

    for (let i = 0; i < cards.length; i++) {
      if (stopRequested) {
        alert('Parado pelo usuário.');
        break;
      }

      try {
        const card = cards[i];
        card.scrollIntoView({ behavior: 'auto', block: 'center' });
        card.click();
        await delay(800); // Rápido pois já está carregado

        const detailContainer = document.getElementById('job-detail');
        if (detailContainer) {
          const data = extractDataFromPanel(detailContainer);
          batchData.push(data);
        }
        
        // Remove da tela para liberar memória (CRUCIAL para 2000+ itens)
        card.remove();

        // Feedback
        if (i % 10 === 0) {
            console.log(`[Scraper] Progresso: ${i}/${cards.length}`);
            chrome.runtime.sendMessage({ type: 'scrape-progress', done: i+1, total: cards.length }).catch(()=>{});
        }

        // Backup de Segurança a cada 50 itens (Salva mas NÃO baixa arquivo)
        if (batchData.length >= 50) {
            chrome.runtime.sendMessage({ type: 'save-backup', payload: batchData }).catch(()=>{});
            batchData = []; // Limpa temp
        }

      } catch (err) {
        console.error(err);
      }
    }

    // Salva o resto e DISPARA O DOWNLOAD FINAL
    if (batchData.length > 0) {
        chrome.runtime.sendMessage({ type: 'save-backup', payload: batchData }, () => {
             // Avisa o background para gerar o arquivo final
             chrome.runtime.sendMessage({ type: 'download-all' });
        });
    } else {
        // Se acabou no múltiplo exato, só baixa
        chrome.runtime.sendMessage({ type: 'download-all' });
    }
  }

  // --- LISTENER ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'scroll-only') scrollOnly(msg.target);
    else if (msg.type === 'scrape-all-loaded') processAllLoaded(); // Novo
    else if (msg.type === 'start-extraction') { /* Logica antiga de lotes 50 se quiser manter */ } 
    else if (msg.type === 'stop-scraping') stopRequested = true;
  });

})();
