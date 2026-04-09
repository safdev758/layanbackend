const http = require('http');

const data = JSON.stringify({
  email: 'admin@layan.com',
  password: 'Admin@123'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🧪 Testing admin login with new credentials...');
console.log('📧 Email: admin@layan.com');
console.log('🔑 Password: Admin@123');
console.log('');

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('');
    
    try {
      const parsed = JSON.parse(responseData);
      
      if (res.statusCode === 200) {
        console.log('✅ Login successful!');
        console.log('');
        console.log('User Info:');
        console.log(`  Name: ${parsed.user.name}`);
        console.log(`  Email: ${parsed.user.email}`);
        console.log(`  Role: ${parsed.user.role}`);
        console.log(`  Status: ${parsed.user.status}`);
        console.log('');
        console.log('🎉 You can now login to the dashboard at http://localhost:4200');
      } else {
        console.log('❌ Login failed:');
        console.log(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('');
  console.log('⚠️  Make sure the backend server is running on port 3000');
});

req.write(data);
req.end();
