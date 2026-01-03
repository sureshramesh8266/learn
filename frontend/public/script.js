// DOM elements
const weightField = document.getElementById('weight');
const rateField = document.getElementById('rate');
const lessrateField = document.getElementById('lessrate');
const amountField = document.getElementById('amount');
const commissionField = document.getElementById('commission');
const otherField = document.getElementById('other_amount');
const totalField = document.getElementById('total');
const exportPdfBtn = document.getElementById('exportPdf');
const exportExcelBtn = document.getElementById('exportExcel');
const addEntryBtn = document.getElementById('addEntryBtn');
const modal = document.getElementById('entryModal');
const closeBtn = document.querySelector('.modal-close');
const cancelBtn = document.getElementById('cancelBtn');
const entryForm = document.getElementById('entryForm');
const addPairBtn = document.getElementById('addPair');
const bhartiPairs = document.getElementById('bhartiPairs');
const entriesTableBody = document.getElementById('entriesTableBody');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const logoutBtn = document.getElementById('logoutBtn');
const confirmBtn = document.querySelector('#entryForm button[type="submit"]');
const modalCloseBtn = document.querySelector('.modal-close');
const modalBackdrop = document.querySelector('.modal-backdrop');
const totalEntriesEl = document.getElementById('totalEntries');
const todayEntriesEl = document.getElementById('todayEntries');
const selectedEntriesEl = document.getElementById('selectedEntries');
const searchInput = document.getElementById('searchInput');

let allEntries = [];
let filteredEntries = [];

// WebSocket connection (optional)
let socket = null;
try {
  if (typeof io !== 'undefined') {
    socket = io('https://learn-ca6w.onrender.com');
  }
} catch (error) {
  console.log('Socket.IO not available, real-time updates disabled');
}

// Listen for deleted entries (if socket is available)
if (socket) {
  socket.on('entriesDeleted', (deletedIds) => {
    deletedIds.forEach(id => {
      const row = document.querySelector(`input[value="${id}"]`)?.closest('tr');
      if (row) row.remove();
    });
    updateSelectAllState();
    updateDeleteButton();
    updateStats();
  });
}

// Update stats
function updateStats() {
  const allRows = document.querySelectorAll('#entriesTableBody tr');
  const selectedRows = document.querySelectorAll('.entry-checkbox:checked');
  const today = new Date().toDateString();
  const todayRows = Array.from(allRows).filter(row => {
    const dateCell = row.cells[1]?.textContent;
    return dateCell && new Date(dateCell).toDateString() === today;
  });
  
  totalEntriesEl.textContent = allRows.length;
  todayEntriesEl.textContent = todayRows.length;
  selectedEntriesEl.textContent = selectedRows.length;
}

// Load entries on page load
document.addEventListener('DOMContentLoaded', loadEntries);

// Load entries from API
async function loadEntries() {
  try {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'table-row';
    
    const response = await fetch('/api/entries');
    const result = await response.json();
    
    if (result.success) {
      allEntries = result.data;
      filteredEntries = result.data;
      displayEntries(result.data);
    }
  } catch (error) {
    console.error('Error loading entries:', error);
  } finally {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
  }
}

// Display entries in table
function displayEntries(entries) {
  entriesTableBody.innerHTML = '';
  
  entries.forEach(entry => {
    addEntryToTable(entry, false);
  });
  
  updateSelectAllState();
  updateStats();
}

// Listen for new entries via WebSocket (if available)
if (socket) {
  socket.on('newEntry', (entry) => {
    // Add to allEntries array to keep it synchronized
    allEntries.unshift(entry);
    addEntryToTable(entry, true);
  });
}

function addEntryToTable(entry, isNew = false) {
  const row = document.createElement('tr');
  
  // Format bharti pairs
  let bhartiDisplay = '';
  if (entry.bharti_pairs) {
    const pairs = typeof entry.bharti_pairs === 'string' ? JSON.parse(entry.bharti_pairs) : entry.bharti_pairs;
    bhartiDisplay = pairs.map(pair => `(${pair.a}×${pair.b})`).join('<br>');
  }
  
  // Calculate ALLAMOUNT (sum of total for same name and date, only for first occurrence)
  const sameNameDateEntries = allEntries.filter(e => 
    e.name === entry.name && 
    new Date(e.entry_date).toDateString() === new Date(entry.entry_date).toDateString()
  );
  
  let allAmount = 0;
  if (sameNameDateEntries.length === 1) {
    // Only one entry with this name+date, show its total
    allAmount = parseFloat(entry.total) || 0;
  } else {
    // Multiple entries, only first one gets the sum
    const firstEntry = sameNameDateEntries.sort((a, b) => a.id - b.id)[0];
    if (entry.id === firstEntry.id) {
      allAmount = sameNameDateEntries.reduce((sum, e) => sum + (parseFloat(e.total) || 0), 0);
    }
  }
  
  row.innerHTML = `
    <td class="checkbox-col">
      <label class="checkbox-wrapper">
        <input type="checkbox" class="entry-checkbox" value="${entry.id}">
        <span class="checkmark"></span>
      </label>
    </td>
    <td>${(() => {
      const date = new Date(entry.entry_date);
      return String(date.getDate()).padStart(2, '0') + '/' + 
             String(date.getMonth() + 1).padStart(2, '0') + '/' + 
             String(date.getFullYear()).slice(-2);
    })()}</td>
    <td><span class="quality-badge">${entry.quality}</span></td>
    <td>${entry.item}</td>
    <td>${entry.name}</td>
    <td>${entry.bags}</td>
    <td class="bharti-cell">${bhartiDisplay}</td>
    <td>${entry.weight}</td>
    <td>${entry.rate}</td>
    <td>${entry.lessrate || 0}</td>
    <td>${entry.amount}</td>
    <td>${entry.commission}</td>
    <td>${entry.other_amount || 0}</td>
    <td class="total-cell">${entry.total}</td>
    <td class="allamount-cell">${allAmount.toFixed(2)}</td>
    <td>${entry.market_fee}</td>
    <td>
      <button class="btn btn-sm btn-outline edit-btn" data-id="${entry.id}">
        <i class="fas fa-edit"></i>
      </button>
    </td>
  `;
  
  // Add to top if new, otherwise append
  if (isNew) {
    entriesTableBody.insertBefore(row, entriesTableBody.firstChild);
  } else {
    entriesTableBody.appendChild(row);
  }
  
  // Add event listener to checkbox
  const checkbox = row.querySelector('.entry-checkbox');
  checkbox.addEventListener('change', () => {
    updateSelectAllState();
    updateDeleteButton();
    updateStats();
  });
  
  // Add event listener to edit button
  const editBtn = row.querySelector('.edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const entryId = parseInt(editBtn.dataset.id);
      editEntry(entryId);
    });
  }
}

function updateDeleteButton() {
  const selectedEntries = getSelectedEntries();
  deleteSelectedBtn.disabled = selectedEntries.length === 0;
}

function updateSelectAllState() {
  const selectAllCheckbox = document.getElementById('selectAll');
  const entryCheckboxes = document.querySelectorAll('.entry-checkbox');
  
  if (selectAllCheckbox && entryCheckboxes.length > 0) {
    const allChecked = Array.from(entryCheckboxes).every(cb => cb.checked);
    const noneChecked = Array.from(entryCheckboxes).every(cb => !cb.checked);
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
  }
}

// Bharti pairs functionality
let pairCount = 1;

function addBhartiPair() {
    pairCount++;
    const pairDiv = document.createElement('div');
    pairDiv.className = 'bharti-pair';
    pairDiv.innerHTML = `
        <span class="plus">+</span>
        <input type="number" step="0.01" class="bharti-a" required>
        <span class="multiply">×</span>
        <input type="number" step="0.01" class="bharti-b" required>
        <button type="button" class="remove-pair">-</button>
    `;
    
    bhartiPairs.appendChild(pairDiv);
    
    // Add event listeners to new inputs
    const inputs = pairDiv.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', calculateWeight);
    });
    
    // Add remove functionality
    const removeBtn = pairDiv.querySelector('.remove-pair');
    removeBtn.addEventListener('click', () => {
        pairDiv.remove();
        pairCount--;
        updateRemoveButtons();
        calculateWeight();
    });
    
    updateRemoveButtons();
}

function updateRemoveButtons() {
    const pairs = bhartiPairs.querySelectorAll('.bharti-pair');
    pairs.forEach((pair, index) => {
        const removeBtn = pair.querySelector('.remove-pair');
        if (pairs.length > 1) {
            removeBtn.style.display = 'flex';
        } else {
            removeBtn.style.display = 'none';
        }
    });
}

// Calculate weight (sum of all bharti multiplications)
function calculateWeight() {
    const pairs = bhartiPairs.querySelectorAll('.bharti-pair');
    let totalWeight = 0;
    
    pairs.forEach(pair => {
        const aInput = pair.querySelector('.bharti-a');
        const bInput = pair.querySelector('.bharti-b');
        const a = parseFloat(aInput.value) || 0;
        const b = parseFloat(bInput.value) || 0;
        totalWeight += (a * b);
    });
    
    weightField.value = totalWeight.toFixed(2);
    calculateAmount();
}

// Add pair button event
addPairBtn.addEventListener('click', addBhartiPair);

// Initial event listeners for first pair
document.addEventListener('DOMContentLoaded', () => {
    const initialInputs = bhartiPairs.querySelectorAll('input');
    initialInputs.forEach(input => {
        input.addEventListener('input', calculateWeight);
    });
});

// Calculate weight (sum of all bharti multiplications)
function calculateWeight() {
    const pairs = bhartiPairs.querySelectorAll('.bharti-pair');
    let totalWeight = 0;
    
    pairs.forEach(pair => {
        const aInput = pair.querySelector('.bharti-a');
        const bInput = pair.querySelector('.bharti-b');
        const a = parseFloat(aInput.value) || 0;
        const b = parseFloat(bInput.value) || 0;
        totalWeight += (a * b);
    });
    
    weightField.value = totalWeight.toFixed(2);
    calculateAmount();
}

// Calculate amount ((rate - lessrate) * weight / 20)
function calculateAmount() {
    const rate = parseFloat(rateField.value) || 0;
    const lessrate = parseFloat(lessrateField.value) || 0;
    const weight = parseFloat(weightField.value) || 0;
    const amount = ((rate - lessrate) * weight) / 20;
    amountField.value = amount.toFixed(2);
    calculateCommission();
}

// Calculate commission (1.5 * amount / 100)
function calculateCommission() {
    const amount = parseFloat(amountField.value) || 0;
    const commission = (1.5 * amount) / 100;
    commissionField.value = commission.toFixed(2);
    calculateTotal();
}

// Calculate total (amount + commission + other)
function calculateTotal() {
    const amount = parseFloat(amountField.value) || 0;
    const commission = parseFloat(commissionField.value) || 0;
    const other = parseFloat(otherField.value) || 0;
    const total = amount + commission + other;
    totalField.value = total.toFixed(2);
}

// Modal functionality
addEntryBtn.addEventListener('click', () => {
    // Reset modal title and button for add mode
    const modalTitle = document.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Entry';
    }
    if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirm';
    }
    
    modal.style.display = 'block';
    // Set today's date as default
    const dateInput = document.querySelector('input[name="entry_date"]');
    if (!dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    resetModal();
});

modalCloseBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    resetModal();
});

modalBackdrop.addEventListener('click', () => {
    modal.style.display = 'none';
    resetModal();
});

cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    resetModal();
});

function resetBhartiPairs() {
    // Remove all pairs except the first one
    const pairs = bhartiPairs.querySelectorAll('.bharti-pair');
    for (let i = 1; i < pairs.length; i++) {
        pairs[i].remove();
    }
    pairCount = 1;
    updateRemoveButtons();
}

function resetModal() {
    // Reset modal title and button text
    const modalTitle = document.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Entry';
    }
    if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirm';
    }
    
    // Clear edit ID
    delete entryForm.dataset.editId;
    
    // Reset form and bharti pairs
    entryForm.reset();
    resetBhartiPairs();
}

// Form submission
entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Disable confirm button
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    
    // Collect bharti pairs data
    const pairs = bhartiPairs.querySelectorAll('.bharti-pair');
    const bhartiData = [];
    pairs.forEach(pair => {
        const a = pair.querySelector('.bharti-a').value;
        const b = pair.querySelector('.bharti-b').value;
        bhartiData.push({ a: parseFloat(a), b: parseFloat(b) });
    });
    
    const formData = new FormData(entryForm);
    const data = Object.fromEntries(formData);
    data.bharti_pairs = bhartiData;
    data.weight = weightField.value;
    
    // Set today's date if not provided
    if (!data.entry_date) {
        data.entry_date = new Date().toISOString().split('T')[0];
    }
    
    try {
        const isEdit = entryForm.dataset.editId;
        const url = isEdit ? `/api/entries/${entryForm.dataset.editId}` : '/api/entries';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            modal.style.display = 'none';
            resetModal();
            if (isEdit) loadEntries(); // Reload entries for edit
        } else {
            alert(isEdit ? 'Error updating entry' : 'Error adding entry');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Re-enable confirm button
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirm';
    }
});

// Delete selected entries
deleteSelectedBtn.addEventListener('click', async () => {
    const selectedEntries = getSelectedEntries();
    
    if (selectedEntries.length === 0) {
        alert('Please select entries to delete');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedEntries.length} entries?`)) {
        return;
    }
    
    // Disable delete button
    deleteSelectedBtn.disabled = true;
    deleteSelectedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    try {
        const response = await fetch('/api/entries', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ entryIds: selectedEntries.map(id => parseInt(id)) })
        });
        
        if (!response.ok) {
            alert('Error deleting entries');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Re-enable delete button
        deleteSelectedBtn.disabled = false;
        deleteSelectedBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Selected';
    }
});

// Event listeners for calculations
rateField.addEventListener('input', calculateAmount);
lessrateField.addEventListener('input', calculateAmount);
otherField.addEventListener('input', calculateTotal);

// Get selected entries for export
function getSelectedEntries() {
    const checkboxes = document.querySelectorAll('.entry-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Select all functionality
const selectAllCheckbox = document.getElementById('selectAll');

if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function() {
        const entryCheckboxes = document.querySelectorAll('.entry-checkbox');
        entryCheckboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
        updateDeleteButton();
        updateStats();
    });
}

// Export PDF
exportPdfBtn.addEventListener('click', async () => {
    const selectedEntries = getSelectedEntries();
    
    if (selectedEntries.length === 0) {
        alert('Please select at least one entry to export');
        return;
    }

    // Disable PDF button
    exportPdfBtn.disabled = true;
    exportPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';

    try {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/export/pdf';
        
        // Add selectedEntries as a JSON string
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'selectedEntries';
        input.value = JSON.stringify(selectedEntries);
        form.appendChild(input);
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Re-enable PDF button after delay
        setTimeout(() => {
            exportPdfBtn.disabled = false;
            exportPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
        }, 3000);
    }
});

// Export Excel
exportExcelBtn.addEventListener('click', async () => {
    const selectedEntries = getSelectedEntries();
    
    if (selectedEntries.length === 0) {
        alert('Please select at least one entry to export');
        return;
    }

    // Disable Excel button
    exportExcelBtn.disabled = true;
    exportExcelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Excel...';

    try {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/export/excel';
        
        // Add selectedEntries as a JSON string
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'selectedEntries';
        input.value = JSON.stringify(selectedEntries);
        form.appendChild(input);
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Re-enable Excel button after delay
        setTimeout(() => {
            exportExcelBtn.disabled = false;
            exportExcelBtn.innerHTML = '<i class="fas fa-file-excel"></i> Excel';
        }, 3000);
    }
});

// Date range filter functionality
document.getElementById('filterByDate').addEventListener('click', function () {
    const startDateVal = document.getElementById('startDate').value;
    const endDateVal = document.getElementById('endDate').value;

    if (!startDateVal || !endDateVal) {
        alert('Please select both start and end dates');
        return;
    }

    const startDate = new Date(startDateVal);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endDateVal);
    endDate.setHours(23, 59, 59, 999);

    const filtered = allEntries.filter(entry => {
        const entryDate = new Date(entry.entry_date);
        return entryDate >= startDate && entryDate <= endDate;
    });

    displayEntries(filtered);
});


// Clear filter functionality
document.getElementById('clearFilter').addEventListener('click', function () {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    displayEntries(allEntries);
    updateStats();
});

// Datewise modal close functionality
document.getElementById('datewiseClose').addEventListener('click', () => {
    document.getElementById('datewiseModal').style.display = 'none';
});

document.querySelector('#datewiseModal .modal-backdrop').addEventListener('click', () => {
    document.getElementById('datewiseModal').style.display = 'none';
});

// Datewise PDF functionality
document.getElementById('datewisePdf').addEventListener('click', async function() {
    const selectedDate = document.getElementById('dateSelect').value;
    if (!selectedDate) {
        alert('No date selected');
        return;
    }
    
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
    
    try {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/export/datewise-pdf';
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'date';
        input.value = selectedDate;
        form.appendChild(input);
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        setTimeout(() => {
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-file-pdf"></i> Get PDF';
        }, 3000);
    }
});

// Edit entry functionality
function editEntry(entryId) {
    const entry = allEntries?.find(e => e.id == entryId);
    if (!entry) {
        alert('Entry not found');
        return;
    }
    
    // Change modal title for edit
    const modalTitle = document.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Entry';
    }
    
    // Change confirm button text
    if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> Update';
    }
    
    // Populate form with entry data - fix date formatting
    const entryDate = new Date(entry.entry_date);
    const formattedDate = entryDate.getFullYear() + '-' + 
                         String(entryDate.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(entryDate.getDate()).padStart(2, '0');
    document.querySelector('input[name="entry_date"]').value = formattedDate;
    document.querySelector('input[name="name"]').value = entry.name;
    document.querySelector('input[name="quality"]').value = entry.quality;
    document.querySelector('input[name="item"]').value = entry.item;
    document.querySelector('input[name="bags"]').value = entry.bags;
    document.querySelector('input[name="rate"]').value = entry.rate;
    document.querySelector('input[name="other_amount"]').value = entry.other_amount || 0;
    document.querySelector('input[name="market_fee"]').value = entry.market_fee;
    document.querySelector('input[name="lessrate"]').value = entry.lessrate || 0;
    
    // Populate bharti pairs
    const bhartiPairs = typeof entry.bharti_pairs === 'string' ? JSON.parse(entry.bharti_pairs) : entry.bharti_pairs;
    resetBhartiPairs();
    
    bhartiPairs.forEach((pair, index) => {
        if (index > 0) addBhartiPair();
        const pairElements = document.querySelectorAll('.bharti-pair');
        const currentPair = pairElements[index];
        currentPair.querySelector('.bharti-a').value = pair.a;
        currentPair.querySelector('.bharti-b').value = pair.b;
    });
    
    calculateWeight();
    
    // Store entry ID for update
    entryForm.dataset.editId = entryId;
    
    // Show modal
    modal.style.display = 'block';
}

// Logout functionality
logoutBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            window.location.href = '/login';
        } else {
            alert('Logout failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});