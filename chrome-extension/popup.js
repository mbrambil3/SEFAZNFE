// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const warningBox = document.getElementById('warningBox');
const mainContent = document.getElementById('mainContent');
const dateStart = document.getElementById('dateStart');
const dateEnd = document.getElementById('dateEnd');
const datePreviewText = document.getElementById('datePreviewText');
const productsLoading = document.getElementById('productsLoading');
const productsEmpty = document.getElementById('productsEmpty');
const productsList = document.getElementById('productsList');
const refreshProducts = document.getElementById('refreshProducts');
const executeBtn = document.getElementById('executeBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultSection = document.getElementById('resultSection');
const totalValue = document.getElementById('totalValue');
const copyTotalBtn = document.getElementById('copyTotalBtn');

// State
let products = [];
let isConnected = false;
let currentTabId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkConnection();
  setupEventListeners();
});

// Check if we're on the correct page
async function checkConnection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab.id;
    
    const isCorrectSite = tab.url && tab.url.includes('nfe-extranet.sefazrs.rs.gov.br');
    
    if (isCorrectSite) {
      setConnected(true);
      await loadProducts();
    } else {
      setConnected(false);
    }
  } catch (error) {
    console.error('Error checking connection:', error);
    setConnected(false);
  }
}

// Update connection status UI
function setConnected(connected) {
  isConnected = connected;
  const statusText = statusBadge.querySelector('.status-text');
  
  if (connected) {
    statusBadge.classList.add('connected');
    statusBadge.classList.remove('disconnected');
    statusText.textContent = 'Conectado';
    warningBox.style.display = 'none';
    mainContent.style.display = 'flex';
  } else {
    statusBadge.classList.add('disconnected');
    statusBadge.classList.remove('connected');
    statusText.textContent = 'Desconectado';
    warningBox.style.display = 'flex';
    mainContent.style.opacity = '0.5';
    mainContent.style.pointerEvents = 'none';
  }
}

// Load products from the page
async function loadProducts() {
  productsLoading.style.display = 'flex';
  productsEmpty.style.display = 'none';
  productsList.style.display = 'none';
  
  try {
    const response = await chrome.tabs.sendMessage(currentTabId, { action: 'getProducts' });
    
    if (response && response.products && response.products.length > 0) {
      products = response.products;
      renderProducts();
      productsLoading.style.display = 'none';
      productsList.style.display = 'flex';
    } else {
      productsLoading.style.display = 'none';
      productsEmpty.style.display = 'flex';
    }
  } catch (error) {
    console.error('Error loading products:', error);
    productsLoading.style.display = 'none';
    productsEmpty.style.display = 'flex';
  }
}

// Render products list
function renderProducts() {
  productsList.innerHTML = '';
  
  products.forEach((product, index) => {
    const item = document.createElement('div');
    item.className = 'product-item fade-in';
    item.style.animationDelay = `${index * 0.05}s`;
    
    item.innerHTML = `
      <div class="product-info">
        <div class="product-name" title="${product.description}">${product.description}</div>
        <div class="product-details">Código: ${product.code} | V. Unit: R$ ${product.unitValue}</div>
      </div>
      <input 
        type="text" 
        class="product-qty-input" 
        data-index="${index}"
        placeholder="Qtd"
        value="${product.newQty || ''}"
        data-testid="product-qty-input-${index}"
      >
    `;
    
    productsList.appendChild(item);
  });
  
  // Add event listeners to quantity inputs
  document.querySelectorAll('.product-qty-input').forEach(input => {
    input.addEventListener('input', handleQtyInput);
  });
  
  updateExecuteButton();
}

// Handle quantity input
function handleQtyInput(e) {
  const index = parseInt(e.target.dataset.index);
  const value = e.target.value.replace(/[^\d,\.]/g, '');
  e.target.value = value;
  products[index].newQty = value;
  updateExecuteButton();
}

// Update date preview
function updateDatePreview() {
  const start = dateStart.value || '__/__';
  const end = dateEnd.value || '__/__';
  datePreviewText.textContent = `De ${start} a ${end}`;
  updateExecuteButton();
}

// Format date input (DD/MM)
function formatDateInput(input) {
  let value = input.value.replace(/\D/g, '');
  
  if (value.length >= 2) {
    value = value.slice(0, 2) + '/' + value.slice(2, 4);
  }
  
  input.value = value;
  updateDatePreview();
}

// Update execute button state
function updateExecuteButton() {
  const hasValidDates = dateStart.value.length === 5 && dateEnd.value.length === 5;
  const hasQuantities = products.some(p => p.newQty && p.newQty.length > 0);
  
  executeBtn.disabled = !hasValidDates || !hasQuantities;
}

// Execute the automation
async function executeAutomation() {
  if (!isConnected) return;
  
  executeBtn.disabled = true;
  progressContainer.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = 'Iniciando...';
  
  const dateRange = `De ${dateStart.value} a ${dateEnd.value}`;
  const productsToEdit = products.filter(p => p.newQty && p.newQty.length > 0);
  const totalSteps = productsToEdit.length + 1; // +1 for date update
  let currentStep = 0;
  
  try {
    // Step 1: Update date range in Observação tab
    progressText.textContent = 'Atualizando intervalo de datas...';
    await chrome.tabs.sendMessage(currentTabId, { 
      action: 'updateDateRange', 
      dateRange: dateRange 
    });
    currentStep++;
    progressFill.style.width = `${(currentStep / totalSteps) * 100}%`;
    
    // Step 2: Edit each product
    for (const product of productsToEdit) {
      progressText.textContent = `Editando: ${product.description}...`;
      
      await chrome.tabs.sendMessage(currentTabId, {
        action: 'editProduct',
        productIndex: product.index,
        newQty: product.newQty
      });
      
      currentStep++;
      progressFill.style.width = `${(currentStep / totalSteps) * 100}%`;
      
      // Small delay between products
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Step 3: Get total value
    progressText.textContent = 'Calculando valor total...';
    const response = await chrome.tabs.sendMessage(currentTabId, { action: 'getTotalValue' });
    
    progressFill.style.width = '100%';
    progressText.textContent = 'Concluído!';
    
    // Show result
    setTimeout(() => {
      resultSection.style.display = 'block';
      resultSection.classList.add('fade-in');
      totalValue.textContent = `R$ ${response.totalValue || '0,00'}`;
      progressContainer.style.display = 'none';
    }, 500);
    
  } catch (error) {
    console.error('Error during automation:', error);
    progressText.textContent = `Erro: ${error.message}`;
    progressFill.style.background = 'var(--accent-error)';
    executeBtn.disabled = false;
  }
}

// Copy total value to clipboard
async function copyTotal() {
  const value = totalValue.textContent;
  
  try {
    await navigator.clipboard.writeText(value);
    copyTotalBtn.classList.add('copied');
    copyTotalBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Copiado!
    `;
    
    setTimeout(() => {
      copyTotalBtn.classList.remove('copied');
      copyTotalBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5H6C4.89543 5 4 5.89543 4 7V19C4 20.1046 4.89543 21 6 21H16C17.1046 21 18 20.1046 18 19V18M8 5C8 6.10457 8.89543 7 10 7H12C13.1046 7 14 6.10457 14 5M8 5C8 3.89543 8.89543 3 10 3H12C13.1046 3 14 3.89543 14 5M14 5H16C17.1046 5 18 5.89543 18 7V10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Copiar Valor
      `;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  dateStart.addEventListener('input', () => formatDateInput(dateStart));
  dateEnd.addEventListener('input', () => formatDateInput(dateEnd));
  refreshProducts.addEventListener('click', loadProducts);
  executeBtn.addEventListener('click', executeAutomation);
  copyTotalBtn.addEventListener('click', copyTotal);
}
