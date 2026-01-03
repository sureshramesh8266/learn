const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Login page (no auth required)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login API endpoint
app.post('/api/login', async (req, res) => {
  try {
    console.log('Frontend login attempt:', req.body);
    console.log('Request cookies:', req.headers.cookie);
    
    const response = await axios.post(`${API_BASE_URL}/login`, req.body, {
      headers: { 
        'Cookie': req.headers.cookie || '',
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    console.log('Backend login response:', response.data);
    console.log('Response cookies:', response.headers['set-cookie']);
    
    // Forward ALL cookies from backend
    if (response.headers['set-cookie']) {
      response.headers['set-cookie'].forEach(cookie => {
        res.setHeader('Set-Cookie', cookie);
      });
    }
    
    res.json(response.data);
  } catch (error) {
    console.log('Login error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || 'Login failed' 
    });
  }
});

// Logout API endpoint
app.post('/api/logout', async (req, res) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/logout`, {}, {
      headers: { Cookie: req.headers.cookie || '' }
    });
    
    // Clear the session cookie
    res.clearCookie('connect.sid');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Apply auth middleware to all routes except login and API
app.use((req, res, next) => {
  console.log('Middleware check for path:', req.path);
  if (req.path === '/login' || req.path.startsWith('/api/') || req.path.match(/\.(css|js|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    console.log('Skipping auth for:', req.path);
    return next();
  }
  console.log('Applying auth check for:', req.path);
  return requireAuth(req, res, next);
});

// Serve static files AFTER auth middleware
app.use(express.static(path.join(__dirname, 'public')));

// Login page (no auth required)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login API endpoint
app.post('/api/login', async (req, res) => {
  try {
    console.log('Frontend login attempt:', req.body);
    console.log('Request cookies:', req.headers.cookie);
    
    const response = await axios.post(`${API_BASE_URL}/login`, req.body, {
      headers: { 
        'Cookie': req.headers.cookie || '',
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    console.log('Backend login response:', response.data);
    console.log('Response cookies:', response.headers['set-cookie']);
    
    // Forward ALL cookies from backend
    if (response.headers['set-cookie']) {
      response.headers['set-cookie'].forEach(cookie => {
        res.setHeader('Set-Cookie', cookie);
      });
    }
    
    res.json(response.data);
  } catch (error) {
    console.log('Login error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || 'Login failed' 
    });
  }
});

// Logout API endpoint
app.post('/api/logout', async (req, res) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/logout`, {}, {
      headers: { Cookie: req.headers.cookie || '' }
    });
    
    // Clear the session cookie
    res.clearCookie('connect.sid');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Authentication middleware
async function requireAuth(req, res, next) {
  try {
    console.log('RequireAuth: Checking auth for:', req.path);
    console.log('RequireAuth: Cookies:', req.headers.cookie);
    
    const response = await axios.get(`${API_BASE_URL}/auth-status`, {
      headers: { Cookie: req.headers.cookie || '' },
      timeout: 5000
    });
    
    console.log('RequireAuth: Auth response:', response.data);
    
    if (response.data.authenticated) {
      console.log('RequireAuth: User is authenticated, proceeding');
      return next();
    } else {
      console.log('RequireAuth: User not authenticated, redirecting to /login');
      return res.redirect('/login');
    }
  } catch (error) {
    console.log('RequireAuth: Auth check failed, redirecting to login:', error.message);
    return res.redirect('/login');
  }
}

// Apply auth middleware to all routes except login and API
app.use((req, res, next) => {
  console.log('Middleware check for path:', req.path);
  if (req.path === '/login' || req.path.startsWith('/api/') || req.path.match(/\.(css|js|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    console.log('Skipping auth for:', req.path);
    return next();
  }
  console.log('Applying auth check for:', req.path);
  return requireAuth(req, res, next);
});

// Protected routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/qualitywise.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qualitywise.html'));
});

// API proxy endpoints
app.get('/api/entries', async (req, res) => {
  try {
    console.log('Fetching entries from:', `${API_BASE_URL}/entries`);
    console.log('Using cookies:', req.headers.cookie);
    
    const response = await axios.get(`${API_BASE_URL}/entries`, {
      headers: { Cookie: req.headers.cookie || '' }
    });
    
    console.log('Entries response status:', response.status);
    console.log('Entries data length:', response.data?.data?.length || 0);
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching entries:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ success: false, error: error.message });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/entries`, req.body, {
      headers: { Cookie: req.headers.cookie || '' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ success: false, error: error.message });
  }
});

app.delete('/api/entries', async (req, res) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/entries`, { 
      data: req.body,
      headers: { Cookie: req.headers.cookie || '' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ success: false, error: error.message });
  }
});

app.post('/api/export/pdf', async (req, res) => {
  try {
    let selectedEntries = req.body.selectedEntries;
    if (typeof selectedEntries === 'string') {
      selectedEntries = JSON.parse(selectedEntries);
    }
    
    const response = await axios.post(`${API_BASE_URL}/export/pdf`, { selectedEntries }, { 
      responseType: 'stream',
      headers: { Cookie: req.headers.cookie || '' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=entries.pdf');
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/export/excel', async (req, res) => {
  try {
    let selectedEntries = req.body.selectedEntries;
    if (typeof selectedEntries === 'string') {
      selectedEntries = JSON.parse(selectedEntries);
    }
    
    const response = await axios.post(`${API_BASE_URL}/export/excel`, { selectedEntries }, { 
      responseType: 'stream',
      headers: { Cookie: req.headers.cookie || '' }
    });

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
    const response = await fetch(`${API_BASE_URL}/datewise-total`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
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
    const response = await fetch(`${API_BASE_URL}/mark-entries`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
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
    const response = await fetch(`${API_BASE_URL}/export/qualitywise-pdf`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
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
    const response = await fetch(`${API_BASE_URL}/export/qualitywise-excel`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
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
    const response = await fetch(`${API_BASE_URL}/entries/${req.params.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
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
    const response = await fetch(`${API_BASE_URL}/export/datewise-pdf`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
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

// Catch all other routes and redirect to login
app.get('*', (req, res) => {
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
});