const axios = require('axios');

async function testStats() {
  try {
    // Step 1: Login
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: 'admin@layan.com',
      password: 'Admin@123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful!');
    console.log(`Token: ${token.substring(0, 20)}...`);
    console.log('');

    // Step 2: Test stats endpoint
    console.log('📊 Fetching dashboard stats...');
    const statsResponse = await axios.get('http://localhost:3000/api/v1/admin/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Stats endpoint working!');
    console.log('');
    console.log('📈 Dashboard Statistics:');
    console.log(JSON.stringify(statsResponse.data, null, 2));
    console.log('');
    console.log('🎉 Everything is working correctly!');

  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.statusText);
    console.error('URL:', error.config?.url);
    console.error('Response:', error.response?.data);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Backend server is not running. Please start it:');
      console.log('   cd backend');
      console.log('   npm start');
    }
  }
}

testStats();
