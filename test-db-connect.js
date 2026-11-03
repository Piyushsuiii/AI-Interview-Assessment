const { Client } = require('pg');
const fs = require('fs');

// Read .env
const env = fs.readFileSync('D:\\AI Interview Assessment platform\\.env', 'utf8');
const match = env.match(/DATABASE_URL="([^"]+)"/);
if (!match) {
  console.log('DATABASE_URL not found in .env');
  process.exit(1);
}

const connectionString = match[1];
console.log('Connecting to database...');

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

client.connect()
  .then(() => {
    console.log('✓ Database connected successfully!');
    return client.query('SELECT version()');
  })
  .then(res => {
    console.log('PostgreSQL version:', res.rows[0].version.substring(0, 50));
    return client.end();
  })
  .catch(err => {
    console.log('✗ Connection failed:', err.message);
    console.log('Error code:', err.code);
    process.exit(1);
  });