# SEFAZ NF-e Editor - Extensão Chrome

Extensão Chrome para automatizar a edição de notas fiscais no sistema NFA-e do SEFAZ RS.

## Funcionalidades

- **Identificação automática de produtos**: A extensão detecta automaticamente todos os produtos cadastrados na aba "Produtos e Serviços"
- **Edição de quantidade em lote**: Insira a quantidade desejada para cada produto e execute todas as alterações de uma vez
- **Atualização de intervalo de datas**: Atualize automaticamente o campo "Informações Complementares de interesse do Contribuinte" na aba "Observação"
- **Cálculo do valor total**: Após as alterações, a extensão soma e exibe o valor total dos produtos para fácil cópia

## Como Instalar

### Passo 1: Baixar a extensão
Baixe todos os arquivos da pasta `chrome-extension` para seu computador.

### Passo 2: Abrir o Chrome Extensions
1. Abra o navegador Google Chrome
2. Digite na barra de endereços: `chrome://extensions/`
3. Pressione Enter

### Passo 3: Ativar o Modo de Desenvolvedor
1. No canto superior direito da página, ative o botão "Modo do desenvolvedor" (Developer mode)

### Passo 4: Carregar a extensão
1. Clique no botão "Carregar sem compactação" (Load unpacked)
2. Navegue até a pasta `chrome-extension` que você baixou
3. Selecione a pasta e clique em "Selecionar pasta"

### Passo 5: Verificar a instalação
A extensão "SEFAZ NF-e Editor" deve aparecer na lista de extensões instaladas.

## Como Usar

### 1. Acesse o site do SEFAZ
Navegue até: `https://nfe-extranet.sefazrs.rs.gov.br/apl/nfa/fpc_common/index.aspx?ref=1`

### 2. Abra a extensão
Clique no ícone da extensão na barra de ferramentas do Chrome (pode estar no menu de extensões)

### 3. Insira o intervalo de datas
- No campo "De:", insira a data inicial (formato DD/MM)
- No campo "a:", insira a data final (formato DD/MM)
- A prévia mostrará como ficará: "De 01/01 a 31/01"

### 4. Defina as quantidades dos produtos
- A extensão listará automaticamente os produtos identificados na nota
- Insira a quantidade desejada para cada produto que deseja alterar
- Deixe em branco os produtos que não deseja modificar

### 5. Execute as alterações
- Clique no botão "Executar Alterações"
- Aguarde o processamento automático
- A barra de progresso mostrará o andamento

### 6. Copie o valor total
- Após a conclusão, o valor total será exibido
- Clique em "Copiar Valor" para copiar o valor para a área de transferência

## Estrutura de Arquivos

```
chrome-extension/
├── manifest.json         # Configuração da extensão
├── popup.html           # Interface do popup
├── popup.css            # Estilos do popup
├── popup.js             # Lógica do popup
├── content.js           # Script de conteúdo (interage com o site)
├── content-styles.css   # Estilos injetados no site
├── icons/               # Ícones da extensão
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # Este arquivo
```

## Requisitos

- Google Chrome (versão 88 ou superior)
- Acesso ao sistema NFA-e do SEFAZ RS

## Observações Importantes

1. **Site específico**: A extensão funciona APENAS no site `nfe-extranet.sefazrs.rs.gov.br`
2. **Nota em edição**: Certifique-se de que a nota fiscal está no modo "EM DIGITAÇÃO" antes de usar a extensão
3. **Backup**: Sempre mantenha um backup das informações originais antes de realizar alterações
4. **Conexão estável**: Mantenha uma conexão de internet estável durante o processamento

## Suporte

Em caso de problemas ou dúvidas, verifique:
1. Se você está no site correto do SEFAZ
2. Se a nota fiscal está no modo de edição
3. Se os campos de data estão no formato correto (DD/MM)
4. Se ao menos um produto tem quantidade definida

## Versão

**v1.0.0** - Versão inicial
- Identificação automática de produtos
- Edição de quantidade comercial
- Atualização de intervalo de datas
- Cálculo e cópia do valor total
