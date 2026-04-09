const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAPI() {
  try {
    console.log('🧪 Testing LAYAN E-commerce API...\n');

    // Test categories endpoint
    console.log('1. Testing GET /api/v1/categories');
    const categories = await makeRequest('/api/v1/categories');
    console.log(`Status: ${categories.status}`);
    console.log(`Categories found: ${categories.data.length || 0}`);
    if (categories.data.length > 0) {
      console.log(`First category: ${categories.data[0].name}`);
    }
    console.log('');

    // Test products endpoint
    console.log('2. Testing GET /api/v1/products');
    const products = await makeRequest('/api/v1/products');
    console.log(`Status: ${products.status}`);
    console.log(`Products found: ${products.data.products ? products.data.products.length : 0}`);
    if (products.data.products && products.data.products.length > 0) {
      console.log(`First product: ${products.data.products[0].name}`);
    }
    console.log('');

    // Test signup endpoint
    console.log('3. Testing POST /api/v1/auth/signup');
    const signupData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      phone: '+1234567890'
    };
    const signup = await makeRequest('/api/v1/auth/signup', 'POST', signupData);
    console.log(`Status: ${signup.status}`);
    console.log(`Signup result: ${signup.data.message || 'Success'}`);
    console.log('');

    console.log('✅ API tests completed!');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testAPI();
