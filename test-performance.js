const axios = require('axios');

// Test performance improvements
const testPerformance = async () => {
  const baseURL = 'http://localhost:3000/api/v1';
  
  console.log('🚀 Testing Performance Improvements...\n');
  
  // Helper function to get auth token (you'll need to replace with actual login)
  const getAuthToken = async () => {
    try {
      // Try to login with test credentials (replace with actual)
      const response = await axios.post(`${baseURL}/auth/login`, {
        email: 'test@supermarket.com', // Replace with actual email
        password: 'password123'        // Replace with actual password
      });
      return response.data.token;
    } catch (error) {
      console.log('⚠️  Could not get auth token, using placeholder');
      // For testing without auth, we'll skip protected endpoints
      return null;
    }
  };
  
  const token = await getAuthToken();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  // Test 1: Get public products with performance metrics
  try {
    console.log('1️⃣ Testing getProducts (public endpoint)...');
    const start = Date.now();
    
    const response = await axios.get(`${baseURL}/products`, {
      params: {
        page: 1,
        limit: 20
      }
    });
    
    const totalTime = Date.now() - start;
    console.log(`✅ Public products loaded in ${totalTime}ms`);
    console.log(`Products returned: ${response.data.products?.length || 0}`);
    console.log(`Total products: ${response.data.pagination?.total || 0}\n`);
    
  } catch (error) {
    console.error('❌ Error testing public products:', error.response?.data || error.message);
  }
  
  // Test 2: Get store products (requires auth) - UPDATED ROUTE
  if (token) {
    try {
      console.log('2️⃣ Testing getStoreProducts with performance metrics...');
      const start = Date.now();
      
      const response = await axios.get(`${baseURL}/products/my-store`, {
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        params: {
          page: 1,
          limit: 20,
          forceRefresh: true
        }
      });
      
      const totalTime = Date.now() - start;
      console.log(`✅ Store products loaded in ${totalTime}ms`);
      console.log(`Response time header: ${response.headers['x-response-time']}`);
      console.log(`Total products: ${response.headers['x-total-products']}`);
      if (response.data.performance) {
        console.log(`Performance data:`, response.data.performance);
      }
      console.log(`Products returned: ${response.data.products?.length || 0}\n`);
      
    } catch (error) {
      console.error('❌ Error testing store products:', error.response?.data || error.message);
    }
    
    // Test 3: Get single product by ID (optimized) - UPDATED ROUTE
    try {
      console.log('3️⃣ Testing getProductByIdForStore (optimized)...');
      const start = Date.now();
      
      const response = await axios.get(`${baseURL}/products/my-store/f84efc8f-0a6c-49b7-a48d-f02f2d92b44f`, {
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        }
      });
      
      const totalTime = Date.now() - start;
      console.log(`✅ Single product loaded in ${totalTime}ms`);
      console.log(`Response time header: ${response.headers['x-response-time']}`);
      if (response.data.performance) {
        console.log(`Performance data:`, response.data.performance);
      }
      console.log(`Product has images: ${response.data.hasImages}`);
      console.log(`Image count: ${response.data.imageCount}\n`);
      
    } catch (error) {
      console.error('❌ Error testing single product:', error.response?.data || error.message);
    }
    
    // Test 4: Update product with performance tracking
    try {
      console.log('4️⃣ Testing updateProduct with performance tracking...');
      const start = Date.now();
      
      const updateData = {
        name: 'Updated Test Product ' + Date.now(),
        price: 29.99,
        description: 'Updated description with performance tracking'
      };
      
      const response = await axios.put(`${baseURL}/products/f84efc8f-0a6c-49b7-a48d-f02f2d92b44f`, updateData, {
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        }
      });
      
      const totalTime = Date.now() - start;
      console.log(`✅ Product updated in ${totalTime}ms`);
      console.log(`Updated product name: ${response.data.name}`);
      console.log(`Updated product price: ${response.data.price}`);
      console.log(`Has images: ${response.data.images ? response.data.images.length : 0}\n`);
      
    } catch (error) {
      console.error('❌ Error testing product update:', error.response?.data || error.message);
    }
  } else {
    console.log('⚠️  Skipping authenticated tests - no valid token available\n');
  }
  
  // Test 5: Test WebSocket connection (basic test)
  try {
    console.log('5️⃣ Testing WebSocket connection...');
    const WebSocket = require('ws');
    
    const ws = new WebSocket('ws://localhost:3000');
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
      
      ws.on('open', () => {
        console.log('✅ WebSocket connection established');
        clearTimeout(timeout);
        
        // Test authentication if we have a token
        if (token) {
          ws.send(JSON.stringify({ token, type: 'authenticate' }));
        }
        
        setTimeout(() => {
          ws.close();
          resolve();
        }, 1000);
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.log('⚠️  WebSocket connection failed:', error.message);
        resolve();
      });
    });
    
  } catch (error) {
    console.log('⚠️  WebSocket test:', error.message);
  }
  
  console.log('\n🎉 Performance testing completed!');
  console.log('\n📝 Updated Recommendations for frontend:');
  console.log('- ✅ Use GET /api/v1/products/my-store/:id for fast single product updates');
  console.log('- ✅ Use GET /api/v1/products/my-store for store products list');
  console.log('- ✅ Use forceRefresh=true when you need fresh data after updates');
  console.log('- ✅ Monitor performance headers for optimization');
  console.log('- ✅ Images are now properly processed and cached');
  console.log('- ✅ WebSocket provides real-time loading states');
  
  if (!token) {
    console.log('\n⚠️  To test authenticated endpoints:');
    console.log('1. Update the login credentials in getAuthToken()');
    console.log('2. Or manually set a valid token');
    console.log('3. Restart the server and run the test again');
  }
  
  console.log('\n🔧 **IMPORTANT**: Server restart required for route changes to take effect!');
  console.log('The new routes are: /my-store and /my-store/:id (not /store and /store-product/:id)');
};

// Run the test
testPerformance().catch(console.error);
