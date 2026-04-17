const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

let mongoDb = null;
const mongoStatus = { connected: false, error: null, dbName: null };

async function connectMongo() {
  if (!MONGODB_URI) {
    mongoStatus.error = 'MONGODB_URI is not configured.';
    console.warn(mongoStatus.error);
    return;
  }
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    mongoDb = client.db();
    mongoStatus.dbName = mongoDb.databaseName;
    const existing = await mongoDb.listCollections({}, { nameOnly: true }).toArray();
    const existingNames = existing.map(c => c.name);
    const requiredCollections = ['zones', 'depots', 'supplies'];
    for (const name of requiredCollections) {
      if (!existingNames.includes(name)) {
        await mongoDb.createCollection(name);
      }
    }
    mongoStatus.connected = true;
    console.log(`MongoDB Atlas connected to database "${mongoStatus.dbName}"`);
  } catch (err) {
    mongoStatus.error = err.message;
    console.error('MongoDB connection failed:', err);
  }
}

connectMongo();

function parseId(id) {
  if (!ObjectId.isValid(id)) throw new Error('Invalid id');
  return new ObjectId(id);
}

function coll(name) {
  return mongoDb ? mongoDb.collection(name) : null;
}

function requireDb(res) {
  if (!mongoStatus.connected || !mongoDb) {
    res.status(503).json({ error: 'MongoDB is not connected.', details: mongoStatus.error });
    return false;
  }
  return true;
}

async function listItems(req, res, collectionName) {
  if (!requireDb(res)) return;
  const items = await coll(collectionName).find({}).toArray();
  res.json(items);
}

async function getItem(req, res, collectionName) {
  if (!requireDb(res)) return;
  try {
    const item = await coll(collectionName).findOne({ _id: parseId(req.params.id) });
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createItem(req, res, collectionName) {
  if (!requireDb(res)) return;
  const body = req.body || {};
  const result = await coll(collectionName).insertOne(body);
  const item = await coll(collectionName).findOne({ _id: result.insertedId });
  res.status(201).json(item);
}

async function updateItem(req, res, collectionName) {
  if (!requireDb(res)) return;
  try {
    const id = parseId(req.params.id);
    const body = req.body || {};
    await coll(collectionName).updateOne({ _id: id }, { $set: body });
    const item = await coll(collectionName).findOne({ _id: id });
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteItem(req, res, collectionName) {
  if (!requireDb(res)) return;
  try {
    const id = parseId(req.params.id);
    const result = await coll(collectionName).deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Item not found.' });
    res.json({ deletedId: req.params.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

const resourceRoutes = [
  { key: 'zones', path: '/api/zones' },
  { key: 'depots', path: '/api/depots' },
  { key: 'supplies', path: '/api/supplies' }
];

resourceRoutes.forEach(route => {
  app.get(route.path, (req, res) => listItems(req, res, route.key));
  app.get(`${route.path}/:id`, (req, res) => getItem(req, res, route.key));
  app.post(route.path, (req, res) => createItem(req, res, route.key));
  app.put(`${route.path}/:id`, (req, res) => updateItem(req, res, route.key));
  app.delete(`${route.path}/:id`, (req, res) => deleteItem(req, res, route.key));
});

// Single /api/status route
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    backend: 'render',
    mongodb: mongoStatus,
    huggingface: { configured: Boolean(HUGGINGFACE_API_KEY) }
  });
});

app.listen(PORT, () => {
  console.log(`Node.js backend server running on http://localhost:${PORT}`);
  console.log(`Serving frontend from ${frontendPath}`);
});