# Entry Management System

A simple web application for managing entries with automatic calculations, PostgreSQL database storage, and PDF/Excel export functionality.

## 🚀 Quick Start

### Development
```bash
# Install all dependencies
npm run install-all

# Start both frontend and backend in development mode
npm run dev
```

### Production
```bash
# Using Docker Compose
docker-compose up -d

# Or manually
npm run build
npm start
```

## 📋 Features

- **Form Fields:**
  - Name (text)
  - Bags (integer)
  - Bharti (two input fields with multiplication)
  - Weight (auto-calculated: bharti_val1 × bharti_val2)
  - Rate (float)
  - Amount (auto-calculated: rate × weight ÷ 20)
  - Commission (auto-calculated: 1.5 × amount ÷ 100)
  - Other (integer)
  - Total (auto-calculated: amount + commission + other)
  - Quality (single character)
  - Market Fee (integer)

- **Export Options:**
  - Select fields using checkboxes
  - Export to PDF
  - Export to Excel

- **Database:**
  - PostgreSQL (Neon) integration
  - Automatic table creation
  - Data persistence

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 16+ and npm 8+
- PostgreSQL database (Neon recommended)
- Git

### Environment Setup
1. Copy environment templates:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Update `backend/.env` with your values:
   ```
   DATABASE_URL=your_neon_database_connection_string
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_secure_password
   SESSION_SECRET=your_32_character_session_secret
   ```

### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Update the `.env` file with your Neon database connection string:
   ```
   DATABASE_URL=your_neon_database_connection_string_here
   PORT=3001
   ```

4. Start the backend server:
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the frontend server:
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

4. Access the application at `http://localhost:3000`

## Database Connection

1. Create a PostgreSQL database on Neon (https://neon.tech/)
2. Copy the connection string
3. Replace `your_neon_database_connection_string_here` in `backend/.env` with your actual connection string

## Usage

1. **Adding Entries:**
   - Fill in the form fields
   - Weight, Amount, Commission, and Total are calculated automatically
   - Click "Add Entry" to save to database

2. **Viewing Entries:**
   - All entries are displayed in the table below the form
   - Data is loaded automatically when the page loads

3. **Exporting Data:**
   - Select the fields you want to export using checkboxes
   - Click "Export PDF" or "Export Excel" to download the selected data

## 🚀 Deployment

Your project is ready for deployment on any platform that supports Node.js applications.

## 🔗 API Endpoints

- `POST /api/entries` - Add new entry
- `GET /api/entries` - Get all entries
- `POST /api/export/pdf` - Export selected fields to PDF
- `POST /api/export/excel` - Export selected fields to Excel

## 📊 Technologies Used

- **Frontend:** Node.js, Express.js, HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js, Socket.IO
- **Database:** PostgreSQL (Neon)
- **Export:** jsPDF, xlsx
- **Authentication:** Express Session
- **Other:** CORS, dotenv

## 🔐 Security Features

- Session-based authentication
- CORS protection
- Environment variable configuration
- Secure cookie settings in production
- Input validation and sanitization

## 📝 License

MIT License - see LICENSE file for details