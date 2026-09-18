const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

let memoryServer;

beforeAll(async () => {
  let uri = process.env.MONGO_URI;

  // In CI (scripts/test.sh) MONGO_URI points at a real, disposable MongoDB
  // container — that's what actually exercises the app against a real
  // database. If it isn't set (e.g. running `npm test` on a laptop with no
  // Mongo running), fall back to an in-memory server so the suite still runs.
  if (!uri) {
    // eslint-disable-next-line global-require
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
});
