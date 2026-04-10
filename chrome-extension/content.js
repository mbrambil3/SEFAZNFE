// Content script for SEFAZ NF-e Editor
// This script runs in the context of the SEFAZ website (including iframes)

// Flag to identify if this frame has products
let hasProducts = false;
let cachedProducts = [];

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('SEFAZ Editor - Message received:', request.action, 'in frame:', window.location.href);
  
  switch (request.action) {
    case 'getProducts':
      getProducts().then(result => {
        console.log('SEFAZ Editor - Sending products:', result);
        sendResponse(result);
      });
      return true; // Indicates async response
      
    case 'updateDateRange':
      updateDateRange(request.dateRange).then(sendResponse);
      return true;
      
    case 'editProduct':
      editProduct(request.productIndex, request.newQty).then(sendResponse);
      return true;
      
    case 'getTotalValue':
      getTotalValue().then(sendResponse);
      return true;
      
    case 'ping':
      // Simple ping to check if content script is loaded
      sendResponse({ success: true, hasProducts: hasProducts, url: window.location.href });
      return true;
  }
});

// Auto-detect products on page load
setTimeout(() => {
  detectProductsInFrame();
}, 1000);

// Detect if this frame contains products
async function detectProductsInFrame() {
  console.log('SEFAZ Editor - Auto-detecting products in frame:', window.location.href);
  
  const result = await getProducts();
  if (result.products && result.products.length > 0) {
    hasProducts = true;
    cachedProducts = result.products;
    console.log('SEFAZ Editor - This frame has products:', result.products.length);
  }
}

// Get products from the "Produtos e Serviços" table
async function getProducts() {
  try {
    console.log('SEFAZ Editor - Starting product detection...');
    
    const products = [];
    
    // Strategy 1: Look for product links (description links like REFEIÇÕES, CAFÉS)
    // These are typically <a> tags with href containing javascript or # 
    const allLinks = document.querySelectorAll('a');
    console.log('SEFAZ Editor - Found links:', allLinks.length);
    
    allLinks.forEach((link, index) => {
      const text = link.textContent.trim();
      const href = link.getAttribute('href') || '';
      
      // Check if this looks like a product description link
      // Product names are usually uppercase letters, accented characters, and spaces
      if (text && text.length >= 2 && 
          text.match(/^[A-ZÀ-Úa-zà-ú\s\-\.]+$/) && 
          !text.match(/^(Incluir|Editar|Excluir|Selecionar|Salvar|Fechar|Validar|Total|Download|Compras)$/i)) {
        
        const row = link.closest('tr');
        if (row) {
          const cells = row.querySelectorAll('td');
          
          if (cells.length >= 4) {
            // Find the cell index of the link
            let linkCellIndex = -1;
            cells.forEach((cell, i) => {
              if (cell.contains(link)) linkCellIndex = i;
            });
            
            // Extract data based on typical SEFAZ table structure
            // Structure: checkbox | # | Código | Descrição | NCM | CFOP | Unid. | Qtd. | V.Unit | V.Total | ...
            const cellTexts = Array.from(cells).map(c => c.textContent.trim());
            
            // Find code (4 digits like 0001, 0002)
            let code = '';
            let description = text;
            let qty = '';
            let unitValue = '';
            let totalValue = '';
            
            cellTexts.forEach((cellText, i) => {
              // Code is usually 4 digits
              if (cellText.match(/^\d{4}$/) && !code) {
                code = cellText;
              }
              // Quantity has decimal with comma (like 88,0000)
              if (cellText.match(/^\d+,\d{4}$/) && !qty) {
                qty = cellText;
              }
              // Unit value (like 23,00 or 23,0000)
              if (cellText.match(/^\d+,\d{2,4}$/) && !unitValue && qty) {
                unitValue = cellText;
              }
              // Total value (like 2.024,00)
              if (cellText.match(/^[\d\.]+,\d{2}$/) && !totalValue) {
                totalValue = cellText;
              }
            });
            
            // Only add if we found a valid product (has code and description)
            if (code && description && !products.find(p => p.code === code)) {
              products.push({
                index: products.length,
                rowIndex: index,
                code: code,
                description: description,
                currentQty: qty,
                unitValue: unitValue,
                totalValue: totalValue,
                newQty: ''
              });
              console.log('SEFAZ Editor - Found product:', code, description);
            }
          }
        }
      }
    });
    
    // Strategy 2: If no products found, try scanning all table rows
    if (products.length === 0) {
      console.log('SEFAZ Editor - Trying table scan strategy...');
      
      const tables = document.querySelectorAll('table');
      
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        
        rows.forEach((row, rowIndex) => {
          const cells = row.querySelectorAll('td');
          
          // Need at least 4 columns for a product row
          if (cells.length >= 4) {
            const cellTexts = Array.from(cells).map(c => c.textContent.trim());
            const rowText = cellTexts.join(' ');
            
            // Skip header rows
            if (rowText.includes('Descrição') && rowText.includes('Código')) return;
            if (rowText.includes('Linhas:')) return;
            
            // Look for rows with a 4-digit code
            let code = '';
            let description = '';
            let qty = '';
            let unitValue = '';
            let totalValue = '';
            
            cellTexts.forEach((text, i) => {
              // 4-digit code
              if (text.match(/^\d{4}$/) && !code) {
                code = text;
              }
              // Description - text with letters (check the cell after code or containing link)
              if (!description) {
                const cell = cells[i];
                const link = cell?.querySelector('a');
                if (link) {
                  description = link.textContent.trim();
                } else if (text.match(/^[A-ZÀ-Úa-zà-ú\s\-\.]+$/) && text.length > 2 && code) {
                  description = text;
                }
              }
              // Qty with 4 decimals
              if (text.match(/^\d+,\d{4}$/) && !qty) {
                qty = text;
              }
              // Unit value
              if (text.match(/^\d+,\d{2,4}$/) && qty && !unitValue) {
                unitValue = text;
              }
              // Total value with thousands separator
              if (text.match(/^[\d\.]+,\d{2}$/) && !totalValue) {
                totalValue = text;
              }
            });
            
            if (code && description && !products.find(p => p.code === code)) {
              products.push({
                index: products.length,
                rowIndex: rowIndex,
                code,
                description,
                currentQty: qty,
                unitValue,
                totalValue,
                newQty: ''
              });
              console.log('SEFAZ Editor - Found product (table scan):', code, description);
            }
          }
        });
      });
    }
    
    // Strategy 3: Look for specific SEFAZ grid elements
    if (products.length === 0) {
      console.log('SEFAZ Editor - Trying grid elements strategy...');
      
      // SEFAZ might use specific IDs or classes
      const gridElements = document.querySelectorAll('[id*="grd"], [id*="Grid"], [class*="grid"], [class*="Grid"]');
      
      gridElements.forEach(grid => {
        const rows = grid.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const cellTexts = Array.from(cells).map(c => c.textContent.trim());
            
            // Find 4-digit code and description
            let code = cellTexts.find(t => t.match(/^\d{4}$/));
            let description = '';
            
            // Find link text for description
            const link = row.querySelector('a');
            if (link) description = link.textContent.trim();
            
            if (code && description && !products.find(p => p.code === code)) {
              products.push({
                index: products.length,
                rowIndex: rowIndex,
                code,
                description,
                currentQty: '',
                unitValue: '',
                totalValue: '',
                newQty: ''
              });
            }
          }
        });
      });
    }
    
    console.log('SEFAZ Editor - Total products found:', products.length);
    console.log('SEFAZ Editor - Products:', products);
    
    return { success: true, products };
    
  } catch (error) {
    console.error('SEFAZ Editor - Error getting products:', error);
    return { success: false, error: error.message, products: [] };
  }
}

// Update date range in the "Observação" tab
async function updateDateRange(dateRange) {
  try {
    // Navigate to "Observação" tab
    await clickTab('Observação');
    await sleep(500);
    
    // Find the "Informações Complementares de interesse do Contribuinte" textarea
    // Based on the screenshot, it's the second textarea
    const textareas = document.querySelectorAll('textarea');
    let targetTextarea = null;
    
    // Look for the textarea by its label or position
    for (const textarea of textareas) {
      const parent = textarea.closest('tr, div, td');
      if (parent) {
        const label = parent.querySelector('label, span, td');
        if (label && label.textContent.includes('Complementares')) {
          targetTextarea = textarea;
          break;
        }
      }
    }
    
    // If not found by label, try the second textarea (based on screenshot structure)
    if (!targetTextarea && textareas.length >= 2) {
      targetTextarea = textareas[1];
    }
    
    // Fallback: any textarea that might contain date pattern
    if (!targetTextarea) {
      for (const textarea of textareas) {
        if (textarea.value.match(/De \d{2}\/\d{2} a \d{2}\/\d{2}/)) {
          targetTextarea = textarea;
          break;
        }
      }
    }
    
    if (!targetTextarea && textareas.length > 0) {
      targetTextarea = textareas[textareas.length - 1]; // Last textarea as fallback
    }
    
    if (targetTextarea) {
      // Clear existing content and set new date range
      targetTextarea.focus();
      targetTextarea.value = dateRange;
      
      // Trigger change events
      targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      targetTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      targetTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
      
      console.log('SEFAZ Editor - Date range updated:', dateRange);
      return { success: true };
    } else {
      throw new Error('Campo de observação não encontrado');
    }
    
  } catch (error) {
    console.error('SEFAZ Editor - Error updating date range:', error);
    return { success: false, error: error.message };
  }
}

// Edit a product's quantity - CORRECT FLOW
async function editProduct(productIndex, newQty) {
  try {
    console.log('SEFAZ Editor - Starting edit for product index:', productIndex, 'new qty:', newQty);
    
    // Step 1: Find all checkboxes and uncheck them first
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    console.log('SEFAZ Editor - Found checkboxes:', allCheckboxes.length);
    
    allCheckboxes.forEach(cb => {
      if (cb.checked) {
        cb.checked = false;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        cb.dispatchEvent(new Event('click', { bubbles: true }));
      }
    });
    
    await sleep(300);
    
    // Step 2: Find the product row and its checkbox
    const tables = document.querySelectorAll('table');
    let targetCheckbox = null;
    let productRow = null;
    let dataRowCount = 0;
    
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          // Check if this row has a checkbox (product row)
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox) {
            // Check if row contains product data (has a 4-digit code)
            const rowText = row.textContent;
            if (rowText.match(/\d{4}/) && !rowText.includes('Código')) {
              if (dataRowCount === productIndex) {
                targetCheckbox = checkbox;
                productRow = row;
                console.log('SEFAZ Editor - Found target product row:', rowText.substring(0, 50));
                break;
              }
              dataRowCount++;
            }
          }
        }
      }
      if (targetCheckbox) break;
    }
    
    if (!targetCheckbox) {
      throw new Error(`Produto índice ${productIndex} não encontrado`);
    }
    
    // Step 3: Check ONLY this product's checkbox
    targetCheckbox.checked = true;
    targetCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    targetCheckbox.dispatchEvent(new Event('click', { bubbles: true }));
    targetCheckbox.focus();
    
    console.log('SEFAZ Editor - Checkbox selected');
    await sleep(500);
    
    // Step 4: Click the "Editar" button
    const editButton = findButtonByText('Editar');
    if (!editButton) {
      throw new Error('Botão Editar não encontrado');
    }
    
    console.log('SEFAZ Editor - Clicking Editar button');
    editButton.click();
    
    // Step 5: Wait 1 second for edit panel to open
    await sleep(1500);
    
    // Step 6: Find and fill the "Qtd. Comercial" field
    // The field is an input next to a label containing "Qtd. Comercial" or "Qtd Comercial"
    let qtyInput = null;
    
    // Strategy 1: Find by looking for label text
    const allLabels = document.querySelectorAll('td, span, label');
    for (const label of allLabels) {
      const text = label.textContent.trim();
      if (text.includes('Qtd. Comercial') || text.includes('Qtd Comercial') || text === '*Qtd. Comercial:') {
        // Look for input in the same row or next element
        const parent = label.closest('tr') || label.parentElement;
        if (parent) {
          const inputs = parent.querySelectorAll('input[type="text"], input:not([type])');
          for (const input of inputs) {
            // Check if this input contains a decimal number (quantity format)
            if (input.value && input.value.match(/^\d+[,\.]\d+$/) || !input.readOnly) {
              qtyInput = input;
              console.log('SEFAZ Editor - Found qty input via label, current value:', input.value);
              break;
            }
          }
        }
        if (qtyInput) break;
      }
    }
    
    // Strategy 2: Find input by value pattern (decimal with 4 places like 88,0000)
    if (!qtyInput) {
      const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
      for (const input of allInputs) {
        if (input.value && input.value.match(/^\d+,\d{4}$/)) {
          qtyInput = input;
          console.log('SEFAZ Editor - Found qty input by pattern, value:', input.value);
          break;
        }
      }
    }
    
    // Strategy 3: Find input near "Qtd" text in the DOM
    if (!qtyInput) {
      const bodyText = document.body.innerHTML;
      const qtdMatch = bodyText.match(/Qtd\.?\s*Comercial.*?<input[^>]*>/i);
      if (qtdMatch) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = qtdMatch[0];
        const foundInput = tempDiv.querySelector('input');
        if (foundInput && foundInput.name) {
          qtyInput = document.querySelector(`input[name="${foundInput.name}"]`);
        }
      }
    }
    
    if (!qtyInput) {
      throw new Error('Campo Qtd. Comercial não encontrado');
    }
    
    // Step 7: Clear and fill the quantity field
    qtyInput.focus();
    qtyInput.select();
    
    // Clear the field
    qtyInput.value = '';
    
    // Format quantity with 4 decimal places (Brazilian format)
    let formattedQty = newQty.replace('.', ',');
    if (!formattedQty.includes(',')) {
      formattedQty = formattedQty + ',0000';
    } else {
      // Ensure 4 decimal places
      const parts = formattedQty.split(',');
      formattedQty = parts[0] + ',' + (parts[1] || '').padEnd(4, '0').substring(0, 4);
    }
    
    qtyInput.value = formattedQty;
    
    // Trigger all relevant events
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
    qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
    qtyInput.dispatchEvent(new Event('blur', { bubbles: true }));
    qtyInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    
    console.log('SEFAZ Editor - Quantity set to:', formattedQty);
    await sleep(500);
    
    // Step 8: Click "Salvar Item" button
    const saveButton = findButtonByText('Salvar Item') || findButtonByText('Salvar');
    if (!saveButton) {
      throw new Error('Botão Salvar Item não encontrado');
    }
    
    console.log('SEFAZ Editor - Clicking Salvar Item button');
    saveButton.click();
    
    // Step 9: Wait for save to complete
    await sleep(1500);
    
    // Step 10: Uncheck the checkbox
    if (targetCheckbox.checked) {
      targetCheckbox.checked = false;
      targetCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      targetCheckbox.dispatchEvent(new Event('click', { bubbles: true }));
    }
    
    console.log('SEFAZ Editor - Product', productIndex, 'edited successfully');
    await sleep(500);
    
    return { success: true };
    
  } catch (error) {
    console.error('SEFAZ Editor - Error editing product:', error);
    return { success: false, error: error.message };
  }
}

// Get total value of all products
async function getTotalValue() {
  try {
    // Navigate to "Produtos e Serviços" tab
    await clickTab('Produtos e Serviços');
    await sleep(500);
    
    let totalValue = 0;
    
    // Find all V. Total values in the table
    const tables = document.querySelectorAll('table');
    
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        
        // V. Total is typically in the 9th column (index 8)
        if (cells.length >= 9) {
          const totalCell = cells[8]?.textContent?.trim() || '';
          const value = parseValue(totalCell);
          if (value > 0) {
            totalValue += value;
          }
        }
      }
    }
    
    // Alternative: look for a total row or summary
    const totalElements = document.querySelectorAll('[class*="total" i], [id*="total" i], td:contains("Total")');
    
    // Format the total value
    const formattedTotal = formatCurrency(totalValue);
    
    console.log('SEFAZ Editor - Total value:', formattedTotal);
    return { success: true, totalValue: formattedTotal };
    
  } catch (error) {
    console.error('SEFAZ Editor - Error getting total:', error);
    return { success: false, error: error.message, totalValue: '0,00' };
  }
}

// Helper function: Click a tab by its text
async function clickTab(tabText) {
  const tabs = document.querySelectorAll('a, button, [role="tab"], td[onclick], span[onclick]');
  
  for (const tab of tabs) {
    if (tab.textContent.trim() === tabText || tab.textContent.includes(tabText)) {
      tab.click();
      await sleep(500);
      return true;
    }
  }
  
  // Try finding by partial match
  for (const tab of tabs) {
    if (tab.textContent.toLowerCase().includes(tabText.toLowerCase())) {
      tab.click();
      await sleep(500);
      return true;
    }
  }
  
  return false;
}

// Helper function: Find button by text (improved)
function findButtonByText(text) {
  // Strategy 1: Input buttons with value
  const inputButtons = document.querySelectorAll('input[type="button"], input[type="submit"]');
  for (const btn of inputButtons) {
    if (btn.value && btn.value.includes(text)) {
      console.log('SEFAZ Editor - Found button by input value:', btn.value);
      return btn;
    }
  }
  
  // Strategy 2: Regular buttons
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent && btn.textContent.includes(text)) {
      console.log('SEFAZ Editor - Found button by text:', btn.textContent);
      return btn;
    }
  }
  
  // Strategy 3: Links styled as buttons
  const links = document.querySelectorAll('a');
  for (const link of links) {
    if (link.textContent && link.textContent.includes(text)) {
      console.log('SEFAZ Editor - Found link button:', link.textContent);
      return link;
    }
  }
  
  // Strategy 4: Images with alt or title
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if ((img.alt && img.alt.includes(text)) || (img.title && img.title.includes(text))) {
      const parent = img.closest('a, button, [onclick], td[onclick], span[onclick]');
      if (parent) {
        console.log('SEFAZ Editor - Found image button:', img.alt || img.title);
        return parent;
      }
      return img;
    }
  }
  
  // Strategy 5: Elements with onclick containing the text
  const allElements = document.querySelectorAll('[onclick]');
  for (const el of allElements) {
    if (el.textContent && el.textContent.includes(text)) {
      console.log('SEFAZ Editor - Found onclick element:', el.textContent.substring(0, 30));
      return el;
    }
  }
  
  // Strategy 6: TD elements that look like buttons
  const tds = document.querySelectorAll('td');
  for (const td of tds) {
    if (td.textContent && td.textContent.trim() === text) {
      const clickable = td.querySelector('[onclick]') || td;
      if (td.onclick || td.getAttribute('onclick')) {
        console.log('SEFAZ Editor - Found TD button:', td.textContent);
        return td;
      }
    }
  }
  
  console.log('SEFAZ Editor - Button not found:', text);
  return null;
}

// Helper function: Find input by label
function findInputByLabel(labelText) {
  // Try to find by associated label
  const labels = document.querySelectorAll('label, span, td');
  
  for (const label of labels) {
    if (label.textContent.includes(labelText)) {
      // Check for 'for' attribute
      const forAttr = label.getAttribute('for');
      if (forAttr) {
        const input = document.getElementById(forAttr);
        if (input) return input;
      }
      
      // Check for nearby input
      const parent = label.closest('tr, div, td');
      if (parent) {
        const input = parent.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
        if (input) return input;
      }
      
      // Check next sibling
      const nextInput = label.nextElementSibling;
      if (nextInput && nextInput.tagName === 'INPUT') {
        return nextInput;
      }
    }
  }
  
  return null;
}

// Helper function: Wait for element
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// Helper function: Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function: Parse Brazilian currency value
function parseValue(str) {
  if (!str) return 0;
  // Remove R$, spaces, and convert Brazilian format to number
  const cleaned = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Helper function: Format as Brazilian currency
function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Log that content script is loaded
console.log('SEFAZ NF-e Editor - Content script loaded');
