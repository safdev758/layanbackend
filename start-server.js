const { migrateDatabase } = require('./migrate-database');
const { spawn } = require('child_process');

async function startServer() {
  try {
    console.log('🚀 Starting LAYAN E-commerce Backend...');
    
    // First, run the migration
    console.log('📦 Running database migration...');
    await migrateDatabase();
    
    // Then start the server
    console.log('🌐 Starting server...');
    const serverProcess = spawn('node', ['server.js'], {
      stdio: 'inherit',
      shell: true
    });
    
    serverProcess.on('error', (error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });
    
    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      process.exit(code);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      serverProcess.kill('SIGINT');
    });
    
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

startServer();

