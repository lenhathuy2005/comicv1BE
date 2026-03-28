require('dotenv').config();
const { query, testConnection } = require('../config/database');

(async () => {
  try {
    await testConnection();
    const tables = await query(`SHOW TABLES`);
    console.table(tables);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
