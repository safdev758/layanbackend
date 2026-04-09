const http = require('http');

// Test the my-store route
const testStoreRoute = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/products/my-store',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        console.log('Response:', parsed);
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.end();
};

// Test the my-store route with a real UUID
const testStoreProductRoute = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/products/my-store/f84efc8f-0a6c-49b7-a48d-f02f2d92b44f',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        console.log('Response:', parsed);
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.end();
};

console.log('Testing my-store route...');
testStoreRoute();

setTimeout(() => {
  console.log('\nTesting my-store/:id route...');
  testStoreProductRoute();
}, 1000);
