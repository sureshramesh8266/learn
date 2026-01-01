const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;
const API_BASE_URL = 'http://localhost:3001/api';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API proxy endpoints
app.get('/api/entries', async (req, res) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/entries`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/entries`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/entries', async (req, res) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/entries`, { data: req.body });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/export/pdf', async (req, res) => {
  try {
    const { selectedEntries } = req.body;
    
    if (!selectedEntries || selectedEntries.length === 0) {
      return res.status(400).json({ success: false, error: 'No entries selected' });
    }
    
    const entriesResponse = await axios.get(`${API_BASE_URL}/entries`);
    const entries = entriesResponse.data.data;
    
    const selectedEntriesData = entries.filter(entry => 
      selectedEntries.includes(entry.id.toString())
    );
    
    if (selectedEntriesData.length === 0) {
      return res.status(400).json({ success: false, error: 'No matching entries found' });
    }
    
    const response = await axios.post(`${API_BASE_URL}/export/pdf`, {
      selectedFields: ['entry_date', 'quality', 'item', 'name', 'bags', 'bharti_pairs', 'weight', 'rate', 'amount', 'commission', 'other_amount', 'total', 'market_fee'],
      entries: selectedEntriesData
    }, { responseType: 'stream' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=entries.pdf');
    response.data.pipe(res);
  } catch (error) {
    console.error('PDF Export Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/export/excel', async (req, res) => {
  try {
    const entriesResponse = await axios.get(`${API_BASE_URL}/entries`);
    const entries = entriesResponse.data.data;
    
    const selectedEntriesData = entries.filter(entry => 
      req.body.selectedEntries.includes(entry.id.toString())
    );
    
    const response = await axios.post(`${API_BASE_URL}/export/excel`, {
      selectedFields: ['entry_date', 'quality', 'item', 'name', 'bags', 'bharti_pairs', 'weight', 'rate', 'amount', 'commission', 'other_amount', 'total', 'market_fee'],
      entries: selectedEntriesData
    }, { responseType: 'stream' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=entries.xlsx');
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Datewise total API endpoint
app.post('/api/datewise-total', async (req, res) => {
  try {
    const response = await fetch('http://localhost:3001/api/datewise-total', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark entries API endpoint
app.post('/api/mark-entries', async (req, res) => {
  try {
    const response = await fetch('http://localhost:3001/api/mark-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Qualitywise PDF export
app.post('/api/export/qualitywise-pdf', async (req, res) => {
  try {
    const response = await fetch('http://localhost:3001/api/export/qualitywise-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    if (response.headers.get('content-type') === 'application/pdf') {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=qualitywise.pdf');
      res.send(buffer);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Qualitywise Excel export
app.post('/api/export/qualitywise-excel', async (req, res) => {
  try {
    const response = await fetch('http://localhost:3001/api/export/qualitywise-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    if (response.headers.get('content-type')?.includes('spreadsheetml')) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=qualitywise.xlsx');
      res.send(buffer);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update entry API endpoint
app.put('/api/entries/:id', async (req, res) => {
  try {
    const response = await fetch(`http://localhost:3001/api/entries/${req.params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Datewise PDF export
app.post('/api/export/datewise-pdf', async (req, res) => {
  try {
    const response = await fetch('http://localhost:3001/api/export/datewise-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    if (response.headers.get('content-type') === 'application/pdf') {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=datewise.pdf');
      res.send(buffer);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
});