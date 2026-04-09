try {
  require('../src/routes/users');
  console.log('users route loaded successfully');
} catch (err) {
  console.error('users route failed to load:', err);
  process.exit(1);
}
