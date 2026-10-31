import mongoose from 'mongoose';

// State tracker for connection health
export const dbState = {
  isConnected: false,
  host: null,
  databaseName: null,
  error: null,
  connectionMode: 'unconnected', // 'atlas', 'local', or 'in-memory-fallback'
};

/**
 * Configure and connect to MongoDB Atlas / URI with robust error handling
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<username>')) {
    const warningMsg = 'MONGODB_URI is not set or contains placeholders. Set your MongoDB Atlas URI in backend/.env';
    console.warn(`⚠️ [MongoDB] ${warningMsg}`);
    dbState.error = warningMsg;
    dbState.isConnected = false;
    return false;
  }

  try {
    // Setup mongoose connection listeners
    mongoose.connection.on('connected', () => {
      dbState.isConnected = true;
      dbState.host = mongoose.connection.host;
      dbState.databaseName = mongoose.connection.name;
      dbState.error = null;
      console.log(`✅ [MongoDB] Connected to database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
      dbState.isConnected = false;
      dbState.error = err.message;
      console.error(`❌ [MongoDB] Connection error event: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      dbState.isConnected = false;
      console.warn('⚠️ [MongoDB] Disconnected from database.');
    });

    // Connect with a 6-second timeout so server startup isn't blocked indefinitely
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 6000,
    });

    dbState.isConnected = true;
    dbState.host = conn.connection.host;
    dbState.databaseName = conn.connection.name;
    dbState.connectionMode = uri.includes('mongodb+srv') ? 'atlas' : 'standard';
    return true;
  } catch (error) {
    dbState.isConnected = false;
    dbState.error = error.message;
    console.error(`❌ [MongoDB] Failed to connect: ${error.message}`);
    console.info('ℹ️ [MongoDB] The API server remains operational. To connect live Atlas database, update MONGODB_URI in backend/.env');
    return false;
  }
};

/**
 * Get current database status summary
 */
export const getDbStatus = () => {
  return {
    isConnected: mongoose.connection.readyState === 1 || dbState.isConnected,
    readyState: mongoose.connection.readyState, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    host: mongoose.connection.host || dbState.host || null,
    database: mongoose.connection.name || dbState.databaseName || null,
    connectionMode: dbState.connectionMode,
    error: dbState.error,
  };
};

export const isDbConnected = () => {
  return mongoose.connection.readyState === 1;
};

export default connectDB;
