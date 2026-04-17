const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://hari07spider_db_user:GHlYlwMmJX8A3oVx@data1.twq1uoh.mongodb.net/?appName=Data1',
  // HUGGINGFACE_API_KEY is not exported for security; access directly from process.env in server.js
};
