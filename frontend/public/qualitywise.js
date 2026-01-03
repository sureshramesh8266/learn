// DOM elements
const entriesTableBody = document.getElementById('entriesTableBody');
const qualityFilter = document.getElementById('qualityFilter');
const statusFilter = document.getElementById('statusFilter');
const selectAllCheckbox = document.getElementById('selectAll');
const markSelectedBtn = document.getElementById('markSelected');
const exportPdfBtn = document.getElementById('exportPdf');
const exportExcelBtn = document.getElementById('exportExcel');
const logoutBtn = document.getElementById('logoutBtn');

let allEntries = [];
let socket = null;

// Initialize Socket.IO connection
function initializeSocket() {
  try {
    socket = io();
    
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    // Listen for new entries
    socket.on('newEntry', (entry) => {
      console.log('New entry received:', entry);
      allEntries.unshift(entry);
      applyFilters();
    });
    
    // Listen for deleted entries
    socket.on('entriesDeleted', (deletedIds) => {
      console.log('Entries deleted:', deletedIds);
      allEntries = allEntries.filter(entry => !deletedIds.includes(entry.id.toString()));
      applyFilters();
    });
    
  } catch (error) {
    console.log('Socket.IO not available:', error.message);
  }
}

// Load entries on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeSocket();
  loadEntries();
});

// Load entries from API
async function loadEntries() {
    try {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'table-row';
        
        const response = await fetch('/api/entries');
        const result = await response.json();
        
        if (result.success) {
            allEntries = result.data;
            displayEntries(allEntries);
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
        const row = document.createElement('tr');
        const isMarked = entry.is_marked;
        
        if (isMarked) {
            row.classList.add('marked-row');
        }
        
        row.innerHTML = `
            <td class="checkbox-col">
                <label class="checkbox-wrapper">
                    <input type="checkbox" class="entry-checkbox" value="${entry.id}" ${isMarked ? 'disabled' : ''}>
                    <span class="checkmark ${isMarked ? 'disabled' : ''}"></span>
                </label>
            </td>
            <td>${((entry.rate * entry.weight) / 20).toFixed(2)}</td>
            <td>${entry.weight}</td>
            <td>${entry.rate}</td>
            <td>${entry.bags}</td>
            <td>${entry.name}</td>
            <td><span class="quality-badge">${entry.quality}</span></td>
            <td>${new Date(entry.entry_date).toLocaleDateString('en-GB').split('/').map(part => part.padStart(2, '0')).join('/')}</td>
            <td><span class="status-badge ${isMarked ? 'marked' : 'available'}">${isMarked ? 'MARKED' : 'AVAILABLE'}</span></td>
            <td>
                ${isMarked ? `<button class="btn btn-sm btn-warning undo-btn" data-id="${entry.id}"><i class="fas fa-undo"></i></button>` : ''}
            </td>
        `;
        
        entriesTableBody.appendChild(row);
        
        if (!isMarked) {
            const checkbox = row.querySelector('.entry-checkbox');
            checkbox.addEventListener('change', updateButtons);
        } else {
            const undoBtn = row.querySelector('.undo-btn');
            if (undoBtn) {
                undoBtn.addEventListener('click', async () => {
                    undoBtn.disabled = true;
                    undoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    const entryId = parseInt(undoBtn.dataset.id);
                    await undoSingleEntry(entryId);
                });
            }
        }
    });
    
    updateButtons();
}

// Quality filter
qualityFilter.addEventListener('change', applyFilters);

// Status filter
statusFilter.addEventListener('change', applyFilters);

// Apply filters function
function applyFilters() {
    const selectedQuality = qualityFilter.value;
    const selectedStatus = statusFilter.value;
    
    let entries = allEntries;
    
    if (selectedQuality) {
        entries = entries.filter(entry => entry.quality === selectedQuality);
    }
    
    if (selectedStatus) {
        if (selectedStatus === 'available') {
            entries = entries.filter(entry => !entry.is_marked);
        } else if (selectedStatus === 'marked') {
            entries = entries.filter(entry => entry.is_marked);
        }
    }
    
    displayEntries(entries);
}

// Update button states
function updateButtons() {
    const selectedEntries = getSelectedEntries();
    const availableSelected = selectedEntries.filter(id => {
        const entry = allEntries.find(e => e.id == id);
        return entry && !entry.is_marked;
    });
    
    markSelectedBtn.disabled = availableSelected.length === 0;
    
    updateSelectAllState();
}

// Get selected entries
function getSelectedEntries() {
    const checkboxes = document.querySelectorAll('.entry-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Get marked entries for undo
function getMarkedEntries() {
    const checkboxes = document.querySelectorAll('.entry-checkbox:checked:disabled');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Update select all state
function updateSelectAllState() {
    const availableCheckboxes = document.querySelectorAll('.entry-checkbox:not(:disabled)');
    if (availableCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.disabled = true;
        return;
    }
    
    selectAllCheckbox.disabled = false;
    const allChecked = Array.from(availableCheckboxes).every(cb => cb.checked);
    const noneChecked = Array.from(availableCheckboxes).every(cb => !cb.checked);
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
}

// Select all functionality
selectAllCheckbox.addEventListener('change', function() {
    const availableCheckboxes = document.querySelectorAll('.entry-checkbox:not(:disabled)');
    availableCheckboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
    });
    updateButtons();
});

// Mark selected entries
markSelectedBtn.addEventListener('click', async () => {
    const selectedEntries = getSelectedEntries().filter(id => {
        const entry = allEntries.find(e => e.id == id);
        return entry && !entry.is_marked;
    });
    
    if (selectedEntries.length === 0) return;
    
    markSelectedBtn.disabled = true;
    markSelectedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marking...';
    
    try {
        const response = await fetch('/api/mark-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryIds: selectedEntries.map(id => parseInt(id)), marked: true })
        });
        
        if (response.ok) {
            // Update entries in allEntries array
            selectedEntries.forEach(id => {
                const entry = allEntries.find(e => e.id == id);
                if (entry) entry.is_marked = true;
            });
            // Reapply current filters instead of loading all entries
            applyFilters();
        } else {
            alert('Error marking entries');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        markSelectedBtn.innerHTML = '<i class="fas fa-check"></i> Mark Selected';
    }
});

// Undo single entry
async function undoSingleEntry(entryId) {
    try {
        const response = await fetch('/api/mark-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryIds: [entryId], marked: false })
        });
        
        if (response.ok) {
            // Update entry in allEntries array
            const entry = allEntries.find(e => e.id == entryId);
            if (entry) entry.is_marked = false;
            // Reapply current filters instead of loading all entries
            applyFilters();
        } else {
            alert('Error undoing entry');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Export PDF
exportPdfBtn.addEventListener('click', async () => {
    const selectedEntries = getSelectedEntries();
    
    if (selectedEntries.length === 0) {
        alert('Please select at least one entry to export');
        return;
    }

    exportPdfBtn.disabled = true;
    exportPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';

    try {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/export/qualitywise-pdf';
        
        selectedEntries.forEach(entryId => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'selectedEntries';
            input.value = entryId;
            form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
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

    exportExcelBtn.disabled = true;
    exportExcelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Excel...';

    try {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/export/qualitywise-excel';
        
        selectedEntries.forEach(entryId => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'selectedEntries';
            input.value = entryId;
            form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        setTimeout(() => {
            exportExcelBtn.disabled = false;
            exportExcelBtn.innerHTML = '<i class="fas fa-file-excel"></i> Excel';
        }, 3000);
    }
});

document.querySelector('#datewiseModal .modal-backdrop').addEventListener('click', () => {
    document.getElementById('datewiseModal').style.display = 'none';
});

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