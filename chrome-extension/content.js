// Content script for SEFAZ NF-e Editor
// This script runs in the context of the SEFAZ website (including iframes)

console.log('SEFAZ NF-e Editor - Content script loaded in:', window.location.href);

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('SEFAZ Editor - Message received:', request.action);
  
  switch (request.action) {
    case 'getProducts':
      getProducts().then(sendResponse);
      return true;
      
    case 'editProduct':
      editProduct(request.productCode, request.productIndex, request.newQty).then(sendResponse);
      return true;
      
    case 'getTotalValue':
      getTotalValue().then(sendResponse);
      return true;
  }
});

// Get products from the table
async function getProducts() {
  try {
    console.log('SEFAZ Editor - Searching for products...');
    const products = [];
    
    // Find all table rows
    const rows = document.querySelectorAll('tr');
    console.log('SEFAZ Editor - Found rows:', rows.length);
    
    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        // Look for a row that has a checkbox and a 4-digit code
        const checkbox = row.querySelector('input[type="checkbox"]');
        const cellTexts = Array.from(cells).map(c => c.textContent.trim());
        
        // Find 4-digit code (like 0001, 0002)
        let code = null;
        let description = null;
        let qty = null;
        let unitValue = null;
        let totalValue = null;
        
        for (let i = 0; i < cellTexts.length; i++) {
          const text = cellTexts[i];
          
          if (!code && text.match(/^\d{4}$/)) {
            code = text;
          } else if (!description && code) {
            const link = cells[i]?.querySelector('a');
            if (link) {
              description = link.textContent.trim();
            } else if (text.match(/^[A-ZÀ-Úa-zà-ú\s\-\.]+$/) && text.length > 1) {
              description = text;
            }
          } else if (!qty && text.match(/^\d+,\d{4}$/)) {
            qty = text;
          } else if (qty && !unitValue && text.match(/^\d+,\d{2,4}$/)) {
            unitValue = text;
          } else if (!totalValue && text.match(/^[\d\.]+,\d{2}$/)) {
            totalValue = text;
          }
        }
        
        if (code && description && checkbox) {
          products.push({
            index: products.length,
            rowIndex: rowIndex,
            code: code,
            description: description,
            currentQty: qty || '',
            unitValue: unitValue || '',
            totalValue: totalValue || '',
            newQty: ''
          });
          console.log('SEFAZ Editor - Found product:', code, description);
        }
      }
    });
    
    console.log('SEFAZ Editor - Total products found:', products.length);
    return { success: true, products };
    
  } catch (error) {
    console.error('SEFAZ Editor - Error getting products:', error);
    return { success: false, error: error.message, products: [] };
  }
}

// Edit a product's quantity
async function editProduct(productCode, productIndex, newQty) {
  try {
    console.log('SEFAZ Editor - editProduct called with code:', productCode, 'qty:', newQty);
    
    // Step 1: Find the product row by code
    let targetRow = null;
    let targetCheckbox = null;
    
    const rows = document.querySelectorAll('tr');
    
    for (const row of rows) {
      const rowText = row.textContent;
      if (rowText.includes(productCode)) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) {
          targetRow = row;
          targetCheckbox = checkbox;
          console.log('SEFAZ Editor - Found product row for code:', productCode);
          break;
        }
      }
    }
    
    if (!targetRow || !targetCheckbox) {
      throw new Error(`Produto ${productCode} não encontrado na tabela`);
    }
    
    // Step 2: Uncheck ALL checkboxes first
    console.log('SEFAZ Editor - Unchecking all checkboxes');
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of allCheckboxes) {
      if (cb.checked) {
        cb.checked = false;
        simulateClick(cb);
        await sleep(100);
      }
    }
    await sleep(500);
    
    // Step 3: Check ONLY the target product checkbox
    console.log('SEFAZ Editor - Selecting checkbox for:', productCode);
    targetCheckbox.checked = true;
    simulateClick(targetCheckbox);
    await sleep(800);
    
    // Step 4: Find and click the "Editar" button
    console.log('SEFAZ Editor - Looking for Editar button');
    const editBtn = findButton('Editar');
    
    if (!editBtn) {
      throw new Error('Botão Editar não encontrado');
    }
    
    console.log('SEFAZ Editor - Found Editar button, clicking...');
    
    // Try multiple click methods
    simulateClick(editBtn);
    await sleep(500);
    
    // If button has onclick attribute, try calling it directly
    if (editBtn.onclick) {
      try {
        editBtn.onclick();
      } catch (e) {}
    }
    
    // Try triggering the click event directly
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    editBtn.dispatchEvent(clickEvent);
    
    // Step 5: Wait for edit panel to open (wait for Qtd. Comercial field or Salvar Item button)
    console.log('SEFAZ Editor - Waiting for edit panel to open...');
    
    let panelOpened = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!panelOpened && attempts < maxAttempts) {
      await sleep(500);
      attempts++;
      
      // Check if the edit panel opened by looking for "Salvar Item" button or "Qtd. Comercial" text
      const salvarBtn = findButton('Salvar Item');
      const qtdLabel = document.body.innerHTML.includes('Qtd. Comercial');
      
      if (salvarBtn || qtdLabel) {
        panelOpened = true;
        console.log('SEFAZ Editor - Edit panel detected!');
      } else {
        console.log('SEFAZ Editor - Waiting... attempt', attempts);
      }
    }
    
    if (!panelOpened) {
      throw new Error('Painel de edição não abriu. Tente novamente.');
    }
    
    await sleep(500);
    
    // Step 6: Find the Qtd. Comercial input field
    console.log('SEFAZ Editor - Looking for Qtd. Comercial field');
    let qtyInput = null;
    
    // Look for input near "Qtd. Comercial" text
    const allTds = document.querySelectorAll('td');
    for (const td of allTds) {
      const text = td.textContent.trim();
      if (text.includes('Qtd. Comercial') || text.includes('Qtd Comercial') || text === '*Qtd. Comercial:') {
        // Get the next td or input in the same row
        const row = td.closest('tr');
        if (row) {
          const inputs = row.querySelectorAll('input[type="text"], input:not([type="checkbox"]):not([type="hidden"]):not([type="button"]):not([type="submit"])');
          for (const inp of inputs) {
            if (!inp.readOnly && !inp.disabled && inp.offsetParent !== null) {
              qtyInput = inp;
              break;
            }
          }
        }
        // Also check sibling td
        const nextTd = td.nextElementSibling;
        if (!qtyInput && nextTd) {
          const inp = nextTd.querySelector('input');
          if (inp && !inp.readOnly && !inp.disabled) {
            qtyInput = inp;
          }
        }
        if (qtyInput) break;
      }
    }
    
    // Fallback: find input with qty pattern
    if (!qtyInput) {
      console.log('SEFAZ Editor - Trying fallback to find qty input by value pattern');
      const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
      for (const inp of allInputs) {
        if (inp.value && inp.value.match(/^\d+,\d{4}$/) && !inp.readOnly && inp.offsetParent !== null) {
          qtyInput = inp;
          console.log('SEFAZ Editor - Found qty input by pattern:', inp.value);
          break;
        }
      }
    }
    
    if (!qtyInput) {
      throw new Error('Campo Qtd. Comercial não encontrado no painel');
    }
    
    console.log('SEFAZ Editor - Found qty input, current value:', qtyInput.value);
    
    // Step 7: Update the quantity field
    qtyInput.focus();
    await sleep(200);
    
    // Select all text
    qtyInput.select();
    await sleep(100);
    
    // Format the new quantity with 4 decimal places
    let formattedQty = newQty.replace('.', ',');
    if (!formattedQty.includes(',')) {
      formattedQty = formattedQty + ',0000';
    } else {
      const parts = formattedQty.split(',');
      formattedQty = parts[0] + ',' + (parts[1] || '').padEnd(4, '0').substring(0, 4);
    }
    
    // Clear and set new value
    qtyInput.value = '';
    qtyInput.value = formattedQty;
    
    // Trigger all events
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
    qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
    qtyInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    qtyInput.dispatchEvent(new Event('blur', { bubbles: true }));
    
    console.log('SEFAZ Editor - Set quantity to:', formattedQty);
    await sleep(500);
    
    // Step 8: Click "Salvar Item" button
    console.log('SEFAZ Editor - Looking for Salvar Item button');
    const saveBtn = findButton('Salvar Item');
    
    if (!saveBtn) {
      throw new Error('Botão Salvar Item não encontrado');
    }
    
    console.log('SEFAZ Editor - Clicking Salvar Item button');
    simulateClick(saveBtn);
    
    if (saveBtn.onclick) {
      try {
        saveBtn.onclick();
      } catch (e) {}
    }
    
    // Step 9: Wait for save to complete
    await sleep(2500);
    
    // Step 10: Uncheck the checkbox if still visible
    if (targetCheckbox && targetCheckbox.checked) {
      targetCheckbox.checked = false;
      simulateClick(targetCheckbox);
    }
    
    console.log('SEFAZ Editor - Product', productCode, 'edited successfully!');
    return { success: true };
    
  } catch (error) {
    console.error('SEFAZ Editor - Error editing product:', error);
    return { success: false, error: error.message };
  }
}

// Get total value
async function getTotalValue() {
  try {
    let totalValue = 0;
    const processedCodes = new Set();
    const rows = document.querySelectorAll('tr');
    
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      const cellTexts = Array.from(cells).map(c => c.textContent.trim());
      const rowText = cellTexts.join('|');
      
      // Find code to identify unique products
      const codeMatch = rowText.match(/\|(\d{4})\|/);
      if (codeMatch && !processedCodes.has(codeMatch[1])) {
        processedCodes.add(codeMatch[1]);
        
        // Find total value in this row
        for (let i = cellTexts.length - 1; i >= 0; i--) {
          if (cellTexts[i].match(/^[\d\.]+,\d{2}$/)) {
            totalValue += parseValue(cellTexts[i]);
            break;
          }
        }
      }
    }
    
    const formattedTotal = formatCurrency(totalValue);
    console.log('SEFAZ Editor - Total value:', formattedTotal);
    return { success: true, totalValue: formattedTotal };
    
  } catch (error) {
    console.error('SEFAZ Editor - Error getting total:', error);
    return { success: false, error: error.message, totalValue: '0,00' };
  }
}

// Simulate a realistic click
function simulateClick(element) {
  if (!element) return;
  
  // Focus first
  element.focus();
  
  // Mouse events
  const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
  const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
  
  element.dispatchEvent(mouseDown);
  element.dispatchEvent(mouseUp);
  element.dispatchEvent(click);
  
  // Also try the native click
  try {
    element.click();
  } catch (e) {}
}

// Find button by text
function findButton(text) {
  // Check input buttons
  const inputs = document.querySelectorAll('input[type="button"], input[type="submit"], input[type="image"]');
  for (const inp of inputs) {
    const value = inp.value || inp.alt || inp.title || '';
    if (value.includes(text)) {
      console.log('SEFAZ Editor - Found button (input):', value);
      return inp;
    }
  }
  
  // Check buttons
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent && btn.textContent.includes(text)) {
      return btn;
    }
  }
  
  // Check links
  const links = document.querySelectorAll('a');
  for (const link of links) {
    if (link.textContent && link.textContent.includes(text)) {
      return link;
    }
  }
  
  // Check images with alt/title
  const imgs = document.querySelectorAll('img');
  for (const img of imgs) {
    if ((img.alt && img.alt.includes(text)) || (img.title && img.title.includes(text))) {
      const parent = img.closest('a, button, [onclick], td');
      if (parent) {
        console.log('SEFAZ Editor - Found button (img):', img.alt || img.title);
        return parent;
      }
      return img;
    }
  }
  
  // Check TD elements with onclick
  const tds = document.querySelectorAll('td[onclick], span[onclick], div[onclick]');
  for (const el of tds) {
    if (el.textContent && el.textContent.trim().includes(text)) {
      return el;
    }
  }
  
  return null;
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse Brazilian currency value
function parseValue(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Format as Brazilian currency
function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
