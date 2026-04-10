// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const warningBox = document.getElementById('warningBox');
const mainContent = document.getElementById('mainContent');
const productsLoading = document.getElementById('productsLoading');
const productsEmpty = document.getElementById('productsEmpty');
const productsList = document.getElementById('productsList');
const refreshProducts = document.getElementById('refreshProducts');
const dateStart = document.getElementById('dateStart');
const dateEnd = document.getElementById('dateEnd');
const datePreview = document.getElementById('datePreview');
const executeBtn = document.getElementById('executeBtn');
const clearBtn = document.getElementById('clearBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultSection = document.getElementById('resultSection');
const totalValue = document.getElementById('totalValue');
const copyTotalBtn = document.getElementById('copyTotalBtn');

// State
let products = [];
let savedState = {};
let isConnected = false;
let currentTabId = null;
let productsFrameId = null;

// Storage key based on tab URL
function getStorageKey() {
  return 'sefaz_editor_state';
}

// Save state to storage
async function saveState() {
  const state = {
    products: products.map(p => ({
      code: p.code,
      description: p.description,
      newQty: p.newQty || '',
      completed: p.completed || false
    })),
    dateStart: dateStart.value,
    dateEnd: dateEnd.value,
    timestamp: Date.now()
  };
  
  await chrome.storage.local.set({ [getStorageKey()]: state });
  console.log('State saved:', state);
}

// Load state from storage
async function loadState() {
  const result = await chrome.storage.local.get(getStorageKey());
  savedState = result[getStorageKey()] || {};
  console.log('State loaded:', savedState);
  return savedState;
}

// Clear state
async function clearState() {
  await chrome.storage.local.remove(getStorageKey());
  savedState = {};
  dateStart.value = '';
  dateEnd.value = '';
  updateDatePreview();
  products.forEach(p => {
    p.newQty = '';
    p.completed = false;
  });
  renderProducts();
  updateExecuteButton();
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  await checkConnection();
  setupEventListeners();
});

// Check connection
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
    console.error('Error:', error);
    setConnected(false);
  }
}

function setConnected(connected) {
  isConnected = connected;
  const statusText = statusBadge.querySelector('.status-text');
  
  if (connected) {
    statusBadge.classList.add('connected');
    statusBadge.classList.remove('disconnected');
    statusText.textContent = 'OK';
    warningBox.style.display = 'none';
    mainContent.style.display = 'flex';
  } else {
    statusBadge.classList.add('disconnected');
    statusBadge.classList.remove('connected');
    statusText.textContent = 'OFF';
    warningBox.style.display = 'block';
    mainContent.style.opacity = '0.5';
    mainContent.style.pointerEvents = 'none';
  }
}

// Load products
async function loadProducts() {
  productsLoading.style.display = 'flex';
  productsEmpty.style.display = 'none';
  productsList.style.display = 'none';
  
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId: currentTabId });
    let allProducts = [];
    
    if (frames) {
      for (const frame of frames) {
        try {
          const response = await chrome.tabs.sendMessage(currentTabId, { action: 'getProducts' }, { frameId: frame.frameId });
          if (response?.products?.length > 0) {
            allProducts = response.products;
            productsFrameId = frame.frameId;
            break;
          }
        } catch (e) {}
      }
    }
    
    if (allProducts.length > 0) {
      // Merge with saved state
      products = allProducts.map(p => {
        const saved = savedState.products?.find(sp => sp.code === p.code);
        return {
          ...p,
          newQty: saved?.newQty || '',
          completed: saved?.completed || false
        };
      });
      
      // Restore dates
      if (savedState.dateStart) dateStart.value = savedState.dateStart;
      if (savedState.dateEnd) dateEnd.value = savedState.dateEnd;
      updateDatePreview();
      
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

// Render products
function renderProducts() {
  productsList.innerHTML = '';
  
  products.forEach((product, index) => {
    const item = document.createElement('div');
    item.className = 'product-item' + (product.completed ? ' completed' : '');
    
    const inputClass = product.newQty ? 'product-qty-input filled' : 'product-qty-input';
    
    item.innerHTML = `
      <div class="product-info">
        <div class="product-name">${product.description}</div>
        <div class="product-details">Cód: ${product.code} | V.U: ${product.unitValue || '-'}</div>
      </div>
      <input type="text" class="${inputClass}" data-index="${index}" placeholder="Qtd" value="${product.newQty || ''}" ${product.completed ? 'disabled' : ''}>
    `;
    
    productsList.appendChild(item);
  });
  
  document.querySelectorAll('.product-qty-input').forEach(input => {
    input.addEventListener('input', handleQtyInput);
    input.addEventListener('change', () => saveState());
  });
  
  updateExecuteButton();
}

// Handle quantity input
function handleQtyInput(e) {
  const index = parseInt(e.target.dataset.index);
  const value = e.target.value.replace(/[^\d,\.]/g, '');
  e.target.value = value;
  products[index].newQty = value;
  
  if (value) {
    e.target.classList.add('filled');
  } else {
    e.target.classList.remove('filled');
  }
  
  updateExecuteButton();
}

// Date input handling
function formatDateInput(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.slice(0, 2) + '/' + value.slice(2, 4);
  }
  input.value = value;
  
  if (value.length === 5) {
    input.classList.add('filled');
  } else {
    input.classList.remove('filled');
  }
  
  updateDatePreview();
  saveState();
}

function updateDatePreview() {
  const start = dateStart.value || '__/__';
  const end = dateEnd.value || '__/__';
  datePreview.textContent = `De ${start} a ${end}`;
}

// Update execute button
function updateExecuteButton() {
  const hasQty = products.some(p => p.newQty && !p.completed);
  const hasDates = dateStart.value.length === 5 && dateEnd.value.length === 5;
  executeBtn.disabled = !hasQty && !hasDates;
}

// Send to products frame
async function sendToFrame(message) {
  if (productsFrameId !== null) {
    return await chrome.tabs.sendMessage(currentTabId, message, { frameId: productsFrameId });
  }
  
  const frames = await chrome.webNavigation.getAllFrames({ tabId: currentTabId });
  for (const frame of frames) {
    try {
      const response = await chrome.tabs.sendMessage(currentTabId, message, { frameId: frame.frameId });
      if (response?.success) return response;
    } catch (e) {}
  }
  throw new Error('Comunicação falhou');
}

// Execute automation
async function executeAutomation() {
  if (!isConnected) return;
  
  executeBtn.disabled = true;
  progressContainer.style.display = 'block';
  progressFill.style.width = '0%';
  
  const productsToEdit = products.filter(p => p.newQty && !p.completed);
  const hasDateChange = dateStart.value.length === 5 && dateEnd.value.length === 5;
  const totalSteps = productsToEdit.length + (hasDateChange ? 1 : 0);
  let currentStep = 0;
  
  try {
    // Edit products
    for (const product of productsToEdit) {
      progressText.textContent = `Editando: ${product.description}...`;
      progressText.textContent += ' (Abra o painel do produto)';
      
      const result = await sendToFrame({
        action: 'editProduct',
        productCode: product.code,
        newQty: product.newQty
      });
      
      if (result?.success) {
        product.completed = true;
        currentStep++;
        progressFill.style.width = `${(currentStep / totalSteps) * 100}%`;
        await saveState();
        renderProducts();
        await new Promise(r => setTimeout(r, 1000));
      } else {
        progressText.textContent = `Erro: ${result?.error || 'Falha'}. Abra o produto manualmente.`;
        await saveState();
        executeBtn.disabled = false;
        return;
      }
    }
    
    // Update date (last step)
    if (hasDateChange) {
      progressText.textContent = 'Atualizando data...';
      const dateText = `De ${dateStart.value} a ${dateEnd.value}`;
      
      const result = await sendToFrame({
        action: 'updateDate',
        dateText: dateText
      });
      
      currentStep++;
      progressFill.style.width = '100%';
      
      if (!result?.success) {
        progressText.textContent = 'Erro ao atualizar data. Faça manualmente na aba Observação.';
      }
    }
    
    // Get total
    progressText.textContent = 'Calculando total...';
    const totalResult = await sendToFrame({ action: 'getTotalValue' });
    
    progressText.textContent = 'Concluído!';
    
    setTimeout(() => {
      resultSection.style.display = 'block';
      totalValue.textContent = `R$ ${totalResult?.totalValue || '0,00'}`;
      progressContainer.style.display = 'none';
    }, 500);
    
  } catch (error) {
    console.error('Error:', error);
    progressText.textContent = `Erro: ${error.message}`;
  }
  
  executeBtn.disabled = false;
  await saveState();
}

// Copy total
async function copyTotal() {
  const value = totalValue.textContent;
  await navigator.clipboard.writeText(value);
  copyTotalBtn.textContent = 'Copiado!';
  setTimeout(() => { copyTotalBtn.textContent = 'Copiar'; }, 1500);
}

// Setup event listeners
function setupEventListeners() {
  refreshProducts.addEventListener('click', loadProducts);
  dateStart.addEventListener('input', () => formatDateInput(dateStart));
  dateEnd.addEventListener('input', () => formatDateInput(dateEnd));
  executeBtn.addEventListener('click', executeAutomation);
  clearBtn.addEventListener('click', clearState);
  copyTotalBtn.addEventListener('click', copyTotal);
}
