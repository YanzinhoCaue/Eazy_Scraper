# Eazy Scraper (Chrome Extension)

Extensão Chrome (Manifest V3) para coletar vagas no portal SeasonalJobs e exportar os dados em CSV.

## Visão geral

A extensão injeta um script na aba ativa para:

- rolar e carregar mais vagas;
- coletar os dados das vagas já carregadas;
- salvar backups em lote no `chrome.storage.local`;
- gerar download automático de CSV ao final.

## Campos exportados

O CSV contém as colunas:

- `titulo`
- `empresa`
- `pagamento`
- `telefone`
- `email`
- `site`

## Estrutura do projeto

- `manifest.json`: configuração da extensão e permissões.
- `popup.html` / `popup.css` / `popup.js`: interface e comandos no popup.
- `content.js`: lógica de rolagem e extração de dados da página.
- `background.js`: service worker, backup em storage e geração de CSV.
- `icons/`: ícone da extensão.

## Permissões usadas

- `scripting`: injetar `content.js` na aba ativa.
- `storage`: guardar vagas coletadas localmente.
- `activeTab`: acessar a aba atual.
- `downloads`: baixar o CSV final.
- `host_permissions`: `https://seasonaljobs.dol.gov/*`.

## Como instalar (modo desenvolvedor)

1. Abra o Chrome em `chrome://extensions/`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta do projeto `Eazy_Scraper`.

## Como usar

1. Acesse o site SeasonalJobs em uma página de listagem de vagas.
2. Abra o popup da extensão.
3. (Opcional) Em **Rolar Tela**, defina o alvo e clique para carregar mais cards.
4. Clique em **COLETAR TUDO (Arquivo Único)**.
5. Confirme a coleta quando solicitado.
6. Aguarde a conclusão — o CSV será baixado automaticamente.

### Ações extras no popup

- **Exportar CSV**: exporta o que já estiver no storage naquele momento.
- **Limpar**: remove `vagasColetadas` do storage local.
- **PARAR**: interrompe o processo de scraping em execução.

## Arquivo gerado

O download final usa o padrão:

`vagas_COMPLETO_HhMm.csv`

Exemplo: `vagas_COMPLETO_14h37m.csv`

## Observações importantes

- Os seletores do `content.js` dependem da estrutura atual do site; mudanças no HTML podem exigir ajuste.
- A coleta em lotes com backup reduz risco de perda em processos longos.
- O script remove cards já processados da tela para reduzir uso de memória em grandes volumes.

## Versão atual

- Nome: **Scraper de Vagas (Lotes Seguros)**
- Versão: **1.0.5**

## Melhorias futuras (sugestões)

- deduplicação por ID/URL da vaga;
- filtro de campos vazios antes da exportação;
- log de erros por vaga com retry seletivo.
