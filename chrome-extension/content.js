// Content script for SEFAZ NF-e Editor
// This script runs in the context of the SEFAZ website

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getProducts':
      getProducts().then(sendResponse);
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
  }
});

// Get products from the "Produtos e Serviços" table
async function getProducts() {
  try {
    // First, navigate to the "Produtos e Serviços" tab
    await clickTab('Produtos e Serviços');
    await waitForElement('table', 2000);
    
    const products = [];
    
    // Find the products table
    // The table structure from the screenshots shows rows with: #, Código, Descrição, NCM, CFOP, Unid., Qtd., V. Unit., V. Total, etc.
    const tables = document.querySelectorAll('table');
    
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        
        // Check if this is a product row (has checkbox in first cell)
        if (cells.length >= 9) {
          const checkbox = cells[0]?.querySelector('input[type="checkbox"]');
          const numberCell = cells[0]?.textContent?.trim() || cells[1]?.textContent?.trim();
          
          // Try to identify product rows by checking for product data
          const codeCell = cells[1]?.textContent?.trim() || '';
          const descriptionCell = cells[2]?.textContent?.trim() || '';
          const qtyCell = cells[6]?.textContent?.trim() || '';
          const unitValueCell = cells[7]?.textContent?.trim() || '';
          const totalValueCell = cells[8]?.textContent?.trim() || '';
          
          // If this looks like a product row
          if (codeCell && descriptionCell && !descriptionCell.includes('Descrição')) {
            products.push({
              index: products.length,
              rowIndex: i,
              code: codeCell,
              description: descriptionCell,
              currentQty: qtyCell.replace(',', '.'),
              unitValue: unitValueCell,
              totalValue: totalValueCell,
              newQty: ''
            });
          }
        }
      }
    }
    
    // Alternative approach: look for specific elements by class or ID
    if (products.length === 0) {
      // Try to find grid/table with specific SEFAZ classes
      const gridRows = document.querySelectorAll('[class*="grid"] tr, [class*="Grid"] tr, [id*="grid"] tr, [id*="Grid"] tr');
      
      gridRows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          const text = row.textContent;
          // Look for typical product patterns
          if (text.match(/\d{4,}/) && !text.includes('Código')) {
            const cellTexts = Array.from(cells).map(c => c.textContent.trim());
            
            // Find the description (usually the longest text or after code)
            let code = '', description = '', qty = '', unitValue = '', totalValue = '';
            
            cellTexts.forEach((text, i) => {
              if (text.match(/^\d{4}$/) && !code) {
                code = text;
              } else if (text.length > 3 && text.match(/^[A-ZÀ-Ú\s]+$/i) && !description) {
                description = text;
              } else if (text.match(/^\d+[,.]?\d*$/) && !qty) {
                qty = text;
              } else if (text.match(/^\d+[,.]\d{2,4}$/) && !unitValue) {
                unitValue = text;
              } else if (text.match(/^\d+[,.]\d{2}$/) && !totalValue) {
                totalValue = text;
              }
            });
            
            if (code && description) {
              products.push({
                index: products.length,
                rowIndex: index,
                code,
                description,
                currentQty: qty,
                unitValue,
                totalValue,
                newQty: ''
              });
            }
          }
        }
      });
    }
    
    // Final fallback: look for links that might be product descriptions
    if (products.length === 0) {
      const productLinks = document.querySelectorAll('a[href*="javascript"]');
      
      productLinks.forEach((link, index) => {
        const text = link.textContent.trim();
        if (text && text.length > 2 && text.match(/^[A-ZÀ-Ú\s]+$/i)) {
          const row = link.closest('tr');
          if (row) {
            const cells = row.querySelectorAll('td');
            const cellTexts = Array.from(cells).map(c => c.textContent.trim());
            
            products.push({
              index: products.length,
              rowIndex: index,
              code: cellTexts[1] || '',
              description: text,
              currentQty: cellTexts[6] || '',
              unitValue: cellTexts[7] || '',
              totalValue: cellTexts[8] || '',
              newQty: ''
            });
          }
        }
      });
    }
    
    console.log('SEFAZ Editor - Products found:', products);
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

// Edit a product's quantity
async function editProduct(productIndex, newQty) {
  try {
    // Navigate to "Produtos e Serviços" tab
    await clickTab('Produtos e Serviços');
    await sleep(500);
    
    // Find and select the product row
    const tables = document.querySelectorAll('table');
    let productRow = null;
    let productFound = false;
    
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      let dataRowIndex = 0;
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          // Check if this is a data row (not header)
          const firstCellText = cells[0]?.textContent?.trim() || '';
          const hasCheckbox = cells[0]?.querySelector('input[type="checkbox"]');
          
          if (hasCheckbox || firstCellText.match(/^\d+$/)) {
            if (dataRowIndex === productIndex) {
              productRow = row;
              productFound = true;
              break;
            }
            dataRowIndex++;
          }
        }
      }
      
      if (productFound) break;
    }
    
    if (!productRow) {
      throw new Error(`Produto índice ${productIndex} não encontrado`);
    }
    
    // Select the product (click checkbox or row)
    const checkbox = productRow.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      checkbox.dispatchEvent(new Event('click', { bubbles: true }));
    } else {
      // Click the row to select
      productRow.click();
    }
    
    await sleep(300);
    
    // Click the "Editar" button
    const editButton = findButtonByText('Editar') || 
                       document.querySelector('[value="Editar"], [title="Editar"], button:contains("Editar"), input[type="button"][value*="Editar"]');
    
    if (editButton) {
      editButton.click();
      await sleep(1000); // Wait for edit modal/form to open
    } else {
      // Try double-clicking the row to edit
      const dblClickEvent = new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window });
      productRow.dispatchEvent(dblClickEvent);
      await sleep(1000);
    }
    
    // Find and update the "Qtd. Comercial" field
    const qtyInput = findInputByLabel('Qtd. Comercial') || 
                     findInputByLabel('Qtd Comercial') ||
                     findInputByLabel('Quantidade') ||
                     document.querySelector('input[name*="qtd" i], input[name*="quantidade" i], input[id*="qtd" i]');
    
    if (qtyInput) {
      qtyInput.focus();
      qtyInput.value = '';
      qtyInput.value = newQty.replace('.', ','); // Use comma for decimal in Brazilian format
      
      // Trigger events
      qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
      qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      qtyInput.dispatchEvent(new Event('blur', { bubbles: true }));
      
      await sleep(300);
    } else {
      throw new Error('Campo de quantidade não encontrado');
    }
    
    // Click "Salvar Item" button
    const saveButton = findButtonByText('Salvar Item') || 
                       findButtonByText('Salvar') ||
                       document.querySelector('[value*="Salvar"], [title*="Salvar"], button:contains("Salvar")');
    
    if (saveButton) {
      saveButton.click();
      await sleep(1000); // Wait for save to complete
    } else {
      throw new Error('Botão Salvar não encontrado');
    }
    
    console.log(`SEFAZ Editor - Product ${productIndex} updated to qty: ${newQty}`);
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

// Helper function: Find button by text
function findButtonByText(text) {
  const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], a.button, [role="button"]');
  
  for (const button of buttons) {
    const buttonText = button.textContent?.trim() || button.value || button.title || '';
    if (buttonText.includes(text)) {
      return button;
    }
  }
  
  // Also check images with alt text
  const images = document.querySelectorAll('img[alt*="' + text + '"], img[title*="' + text + '"]');
  for (const img of images) {
    const parent = img.closest('a, button, [onclick]');
    if (parent) return parent;
  }
  
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
