const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

const createTable = async () => {
  let retries = 3;
  while (retries > 0) {
    try {
      console.log('Connecting to database...');
      await pool.query('SELECT NOW()');
      console.log('Database connected successfully');
      break;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.log(`Connection failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  try {
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id SERIAL PRIMARY KEY,
        entry_date DATE NOT NULL,
        name VARCHAR(255) NOT NULL,
        bags INTEGER NOT NULL,
        bharti_pairs JSONB NOT NULL,
        weight DECIMAL(10,2) NOT NULL,
        rate DECIMAL(10,2) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        commission DECIMAL(10,2) NOT NULL,
        other_amount INTEGER DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        quality CHAR(1) NOT NULL,
        item VARCHAR(255) NOT NULL,
        market_fee INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100) DEFAULT 'system',
        updated_by VARCHAR(100) DEFAULT 'system'
      )
    `);
    
    // Add item column if it doesn't exist
    try {
      await pool.query(`ALTER TABLE entries ADD COLUMN IF NOT EXISTS item VARCHAR(255) DEFAULT 'N/A'`);
    } catch (err) {
      // Column might already exist, ignore error
    }
    
    // Add is_marked column if it doesn't exist
    try {
      await pool.query(`ALTER TABLE entries ADD COLUMN IF NOT EXISTS is_marked BOOLEAN DEFAULT FALSE`);
    } catch (err) {
      // Column might already exist, ignore error
    }
    
    // Add lessrate column if it doesn't exist
    try {
      await pool.query(`ALTER TABLE entries ADD COLUMN IF NOT EXISTS lessrate DECIMAL(10,2) DEFAULT 0`);
    } catch (err) {
      // Column might already exist, ignore error
    }
    
    // Create trigger for updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS update_entries_updated_at ON entries;
      CREATE TRIGGER update_entries_updated_at
        BEFORE UPDATE ON entries
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    
    console.log('Table and triggers created successfully');
  } catch (err) {
    console.error('Error creating table:', err);
    throw err;
  }
};

module.exports = { pool, createTable };