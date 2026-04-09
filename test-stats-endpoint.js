const http = require('http');

// First, let's test if the server is running
const testConnection = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const loginData = JSON.stringify({
    email: 'admin@layan.com',
    password: 'Admin@123'
  });

  console.log('🔍 Testing backend connection...\n');

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        const response = JSON.parse(data);
        console.log('✅ Backend is running!');
        console.log('✅ Login successful!\n');
        
        // Now test the stats endpoint
        testStatsEndpoint(response.token);
      } else {
        console.log('❌ Login failed:', res.statusCode);
        console.log(data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Backend is NOT running!');
    console.error('Error:', error.message);
    console.log('\n💡 Please start the backend server:');
    console.log('   cd backend');
    console.log('   npm start');
  });

  req.write(loginData);
  req.end();
};

const testStatsEndpoint = (token) => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/admin/stats',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  console.log('🔍 Testing /api/v1/admin/stats endpoint...\n');

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`Status Code: ${res.statusCode}\n`);
      
      if (res.statusCode === 200) {
        const stats = JSON.parse(data);
        console.log('✅ Stats endpoint is working!\n');
        console.log('📊 Dashboard Statistics:');
        console.log(`   Total Users: ${stats.totalUsers}`);
        console.log(`   Active Users: ${stats.activeUsers}`);
        console.log(`   Total Orders: ${stats.totalOrders}`);
        console.log(`   Pending Orders: ${stats.pendingOrders}`);
        console.log(`   Total Revenue: $${stats.totalRevenue.toFixed(2)}`);
        console.log(`   Total Products: ${stats.totalProducts}`);
        console.log('\n✅ Everything is working correctly!');
        console.log('🎉 Your dashboard should now load the stats properly.');
      } else {
        console.log('❌ Stats endpoint failed!');
        console.log('Response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error testing stats endpoint:', error.message);
  });

  req.end();
};

// Run the test
testConnection();
