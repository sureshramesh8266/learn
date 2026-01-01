const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { pool, createTable } = require('./database');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const XLSX = require('xlsx');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Initialize database
createTable();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Add new entry
app.post('/api/entries', async (req, res) => {
  try {
    const {
      entry_date, name, bags, bharti_pairs, weight, rate, amount,
      commission, other_amount, total, quality, item, market_fee
    } = req.body;

    const result = await pool.query(
      `INSERT INTO entries (entry_date, name, bags, bharti_pairs, weight, rate, amount, commission, other_amount, total, quality, item, market_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [entry_date, name, bags, JSON.stringify(bharti_pairs), weight, rate, amount, commission, other_amount || 0, total, quality, item, market_fee]
    );

    const newEntry = result.rows[0];
    
    // Emit new entry to all connected clients
    io.emit('newEntry', newEntry);
    
    res.json({ success: true, data: newEntry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all entries
app.get('/api/entries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entries ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete entries
app.delete('/api/entries', async (req, res) => {
  try {
    const { entryIds } = req.body;
    
    if (!entryIds || entryIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No entries selected' });
    }
    
    const placeholders = entryIds.map((_, index) => `$${index + 1}`).join(',');
    const result = await pool.query(
      `DELETE FROM entries WHERE id IN (${placeholders}) RETURNING id`,
      entryIds
    );
    
    // Emit deletion to all connected clients
    io.emit('entriesDeleted', entryIds);
    
    res.json({ success: true, deletedCount: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export PDF
app.post('/api/export/pdf', async (req, res) => {
  try {
    const { selectedFields, entries } = req.body;
    
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Entries Report', 20, 20);

    const headers = [];
    const fieldMap = {
      entry_date: 'DATE',
      quality: 'QUALITY',
      item: 'ITEM',
      name: 'NAME',
      bags: 'BAGS',
      bharti_pairs: 'BHARTI',
      weight: 'WEIGHT',
      rate: 'RATE',
      amount: 'AMOUNT',
      commission: 'COMMISSION',
      other_amount: 'OTHER',
      total: 'TOTAL',
      market_fee: 'MARKET FEE'
    };

    selectedFields.forEach(field => {
      if (fieldMap[field]) {
        headers.push(fieldMap[field]);
      }
    });

    const data = entries.map(entry => {
      return selectedFields.map(field => {
        if (field === 'bharti_pairs') {
          const pairs = typeof entry[field] === 'string' ? JSON.parse(entry[field]) : entry[field];
          return pairs.map(pair => `(${pair.a}×${pair.b})`).join('\n');
        }
        if (field === 'entry_date') {
          // Format date as YYYY-MM-DD to avoid timezone issues
          const date = new Date(entry[field]);
          return date.getFullYear() + '-' + 
                 String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(date.getDate()).padStart(2, '0');
        }
        return entry[field] || '';
      });
    });

    // Calculate totals
    const totals = {
      bags: entries.reduce((sum, entry) => sum + (parseFloat(entry.bags) || 0), 0),
      weight: entries.reduce((sum, entry) => sum + (parseFloat(entry.weight) || 0), 0),
      total: entries.reduce((sum, entry) => sum + (parseFloat(entry.total) || 0), 0),
      market_fee: entries.reduce((sum, entry) => sum + (parseFloat(entry.market_fee) || 0), 0)
    };

    doc.autoTable({
      head: [headers],
      body: data,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fontSize: 6, fontStyle: 'bold', halign: 'center' },
      tableWidth: 'auto',
      margin: { left: 10, right: 10 },
      theme: 'grid'
    });
    
    // Store column widths for totals alignment
    const columnWidths = doc.lastAutoTable.columns.map(col => col.width);
    
    // Add totals row with exact column alignment
    const totalRow = selectedFields.map(field => {
      if (field === 'bags') return totals.bags.toString();
      if (field === 'weight') return totals.weight.toFixed(2);
      if (field === 'total') return totals.total.toFixed(2);
      if (field === 'market_fee') return totals.market_fee.toString();
      return '';
    });
    
    doc.autoTable({
      body: [totalRow],
      startY: doc.lastAutoTable.finalY,
      styles: { fontSize: 8, fontStyle: 'bold', fillColor: [240, 240, 240], cellPadding: 2, halign: 'center' },
      theme: 'grid',
      tableWidth: 'auto',
      margin: { left: 10, right: 10 },
      columnStyles: columnWidths.reduce((acc, width, index) => {
        acc[index] = { cellWidth: width };
        return acc;
      }, {})
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=entries.pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export Excel
app.post('/api/export/excel', async (req, res) => {
  try {
    const { selectedFields, entries } = req.body;
    
    const filteredData = entries.map(entry => {
      const filtered = {};
      selectedFields.forEach(field => {
        if (field === 'bharti_pairs') {
          const pairs = typeof entry[field] === 'string' ? JSON.parse(entry[field]) : entry[field];
          filtered[field] = pairs.map(pair => `(${pair.a}×${pair.b})`).join('\n');
        } else if (field === 'entry_date') {
          filtered[field] = new Date(entry[field]).toLocaleDateString();
        } else {
          filtered[field] = entry[field];
        }
      });
      return filtered;
    });

    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entries');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=entries.xlsx');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Datewise total endpoint
app.post('/api/datewise-total', async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    const query = `
      SELECT 
        COALESCE(SUM(bags), 0) as total_bags,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(SUM(market_fee), 0) as total_market_fee
      FROM entries 
      WHERE entry_date = $1
    `;
    
    const result = await pool.query(query, [date]);
    const totals = result.rows[0];
    
    res.json({
      totalBags: parseInt(totals.total_bags),
      totalWeight: parseFloat(totals.total_weight),
      totalAmount: parseFloat(totals.total_amount),
      totalMarketFee: parseInt(totals.total_market_fee)
    });
  } catch (error) {
    console.error('Error getting datewise total:', error);
    res.status(500).json({ error: 'Failed to get datewise total' });
  }
});

// Mark/Unmark entries
app.post('/api/mark-entries', async (req, res) => {
  try {
    const { entryIds, marked } = req.body;
    
    if (!entryIds || entryIds.length === 0) {
      return res.status(400).json({ error: 'No entries provided' });
    }
    
    const placeholders = entryIds.map((_, index) => `$${index + 2}`).join(',');
    await pool.query(
      `UPDATE entries SET is_marked = $1 WHERE id IN (${placeholders})`,
      [marked, ...entryIds]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking entries:', error);
    res.status(500).json({ error: 'Failed to mark entries' });
  }
});

// Qualitywise PDF export
app.post('/api/export/qualitywise-pdf', async (req, res) => {
  try {
    const { selectedEntries } = req.body;
    
    if (!selectedEntries || selectedEntries.length === 0) {
      return res.status(400).json({ error: 'No entries selected' });
    }
    
    // Ensure selectedEntries is an array
    const entryIds = Array.isArray(selectedEntries) ? selectedEntries : [selectedEntries];
    
    const placeholders = entryIds.map((_, index) => `$${index + 1}`).join(',');
    const result = await pool.query(
      `SELECT * FROM entries WHERE id IN (${placeholders}) ORDER BY entry_date DESC`,
      entryIds
    );
    
    const entries = result.rows;
    const selectedFields = ['entry_date', 'name', 'quality', 'amount', 'weight', 'rate', 'bags'];
    
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Qualitywise Report', 20, 20);

    const headers = ['AMOUNT', 'WEIGHT', 'RATE', 'BAGS', 'ITEM', 'NAME', 'QUALITY', 'DATE'];
    const data = entries.map(entry => [
      entry.amount,
      entry.weight,
      entry.rate,
      entry.bags,
      entry.item,
      entry.name,
      entry.quality,
      new Date(entry.entry_date).toLocaleDateString()
    ]);

    doc.autoTable({
      head: [headers],
      body: data,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fontSize: 6, fontStyle: 'bold', halign: 'center' },
      tableWidth: 'auto',
      margin: { left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 'auto' }
      },
      theme: 'grid'
    });
    
    // Calculate totals
    const totals = {
      amount: entries.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0),
      weight: entries.reduce((sum, entry) => sum + (parseFloat(entry.weight) || 0), 0),
      rate: entries.reduce((sum, entry) => sum + (parseFloat(entry.rate) || 0), 0),
      bags: entries.reduce((sum, entry) => sum + (parseFloat(entry.bags) || 0), 0)
    };
    
    // Store column widths for totals alignment
    const columnWidths = doc.lastAutoTable.columns.map(col => col.width);
    
    // Add totals row with exact column alignment
    const totalRow = [
      totals.amount.toFixed(2),
      totals.weight.toFixed(2), 
      totals.rate.toFixed(2),
      totals.bags.toString(),
      '',
      '',
      '',
      ''
    ];
    
    doc.autoTable({
      body: [totalRow],
      startY: doc.lastAutoTable.finalY,
      styles: { fontSize: 8, fontStyle: 'bold', fillColor: [240, 240, 240], cellPadding: 2, halign: 'center' },
      theme: 'grid',
      tableWidth: 'auto',
      margin: { left: 10, right: 10 },
      columnStyles: columnWidths.reduce((acc, width, index) => {
        acc[index] = { cellWidth: width };
        return acc;
      }, {})
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=qualitywise.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting qualitywise PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// Qualitywise Excel export
app.post('/api/export/qualitywise-excel', async (req, res) => {
  try {
    const { selectedEntries } = req.body;
    
    if (!selectedEntries || selectedEntries.length === 0) {
      return res.status(400).json({ error: 'No entries selected' });
    }
    
    // Ensure selectedEntries is an array
    const entryIds = Array.isArray(selectedEntries) ? selectedEntries : [selectedEntries];
    
    const placeholders = entryIds.map((_, index) => `$${index + 1}`).join(',');
    const result = await pool.query(
      `SELECT * FROM entries WHERE id IN (${placeholders}) ORDER BY entry_date DESC`,
      entryIds
    );
    
    const entries = result.rows;
    const filteredData = entries.map(entry => ({
      AMOUNT: entry.amount,
      WEIGHT: entry.weight,
      RATE: entry.rate,
      BAGS: entry.bags,
      ITEM: entry.item,
      NAME: entry.name,
      QUALITY: entry.quality,
      DATE: new Date(entry.entry_date).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Qualitywise');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=qualitywise.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting qualitywise Excel:', error);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

// Update entry
app.put('/api/entries/:id', async (req, res) => {
  try {
    const entryId = req.params.id;
    const {
      entry_date, name, bags, bharti_pairs, weight, rate, amount,
      commission, other_amount, total, quality, item, market_fee
    } = req.body;

    const result = await pool.query(
      `UPDATE entries SET entry_date = $1, name = $2, bags = $3, bharti_pairs = $4, weight = $5, rate = $6, amount = $7, commission = $8, other_amount = $9, total = $10, quality = $11, item = $12, market_fee = $13, updated_at = CURRENT_TIMESTAMP WHERE id = $14 RETURNING *`,
      [entry_date, name, bags, JSON.stringify(bharti_pairs), weight, rate, amount, commission, other_amount || 0, total, quality, item, market_fee, entryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Entry not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Datewise PDF export
app.post('/api/export/datewise-pdf', async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM entries WHERE entry_date = $1 ORDER BY created_at DESC',
      [date]
    );
    
    const entries = result.rows;
    
    if (entries.length === 0) {
      return res.status(400).json({ error: 'No entries found for this date' });
    }
    
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Datewise Report - ${new Date(date).toLocaleDateString()}`, 20, 20);

    const headers = ['DATE', 'QUALITY', 'ITEM', 'NAME', 'BAGS', 'BHARTI', 'WEIGHT', 'RATE', 'AMOUNT', 'COMMISSION', 'OTHER', 'TOTAL', 'MARKET FEE'];
    const data = entries.map(entry => {
      const bhartiPairs = typeof entry.bharti_pairs === 'string' ? JSON.parse(entry.bharti_pairs) : entry.bharti_pairs;
      const bhartiDisplay = bhartiPairs.map(pair => `(${pair.a}×${pair.b})`).join('\n');
      
      return [
        new Date(entry.entry_date).toLocaleDateString(),
        entry.quality,
        entry.item,
        entry.name,
        entry.bags,
        bhartiDisplay,
        entry.weight,
        entry.rate,
        entry.amount,
        entry.commission,
        entry.other_amount || 0,
        entry.total,
        entry.market_fee
      ];
    });

    const totals = {
      bags: entries.reduce((sum, entry) => sum + (parseFloat(entry.bags) || 0), 0),
      weight: entries.reduce((sum, entry) => sum + (parseFloat(entry.weight) || 0), 0),
      total: entries.reduce((sum, entry) => sum + (parseFloat(entry.total) || 0), 0),
      market_fee: entries.reduce((sum, entry) => sum + (parseFloat(entry.market_fee) || 0), 0)
    };

    doc.autoTable({
      head: [headers],
      body: data,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fontSize: 6, fontStyle: 'bold', halign: 'center' },
      tableWidth: 'auto',
      margin: { left: 10, right: 10 },
      theme: 'grid'
    });
    
    const columnWidths = doc.lastAutoTable.columns.map(col => col.width);
    
    const totalRow = [
      '',
      '',
      '',
      '',
      totals.bags.toString(),
      '',
      totals.weight.toFixed(2),
      '',
      '',
      '',
      '',
      totals.total.toFixed(2),
      totals.market_fee.toString()
    ];
    
    doc.autoTable({
      body: [totalRow],
      startY: doc.lastAutoTable.finalY,
      styles: { fontSize: 8, fontStyle: 'bold', fillColor: [240, 240, 240], cellPadding: 2, halign: 'center' },
      theme: 'grid',
      tableWidth: 'auto',
      margin: { left: 10, right: 10 },
      columnStyles: columnWidths.reduce((acc, width, index) => {
        acc[index] = { cellWidth: width };
        return acc;
      }, {})
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=datewise.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting datewise PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});