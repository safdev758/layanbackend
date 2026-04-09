const fetch = require('node-fetch');

async function testServerConnection() {
    try {
        console.log('🧪 Testing server connection and endpoints...');
        
        // Test 1: Check if server is running
        console.log('\n1️⃣ Testing server health...');
        const healthResponse = await fetch('http://localhost:3000/api/v1/auth', {
            method: 'GET'
        });
        
        if (healthResponse.status === 404 || healthResponse.status === 405) {
            console.log('✅ Server is running and responding');
        } else if (healthResponse.ok) {
            console.log('✅ Server is running and responding');
        } else {
            console.log('❌ Server not responding properly');
            return;
        }
        
        // Test 2: Test products endpoint without auth
        console.log('\n2️⃣ Testing public products endpoint...');
        const productsResponse = await fetch('http://localhost:3000/api/v1/products?page=1&limit=5', {
            method: 'GET'
        });
        
        if (productsResponse.ok) {
            const productsData = await productsResponse.json();
            console.log(`✅ Public products endpoint working`);
            console.log(`   Found ${productsData.products?.length || 0} products`);
        } else {
            console.log('ℹ️ Public products endpoint may require auth');
        }
        
        // Test 3: Create a test user
        console.log('\n3️⃣ Creating test supermarket user...');
        const createUserResponse = await fetch('http://localhost:3000/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'testsupermarket@example.com',
                password: 'Test123!',
                name: 'Test Supermarket',
                role: 'SUPERmarket'
            })
        });
        
        if (createUserResponse.ok) {
            console.log('✅ Test user created successfully');
        } else {
            const errorData = await createUserResponse.json();
            console.log('ℹ️ User may already exist or:', errorData.message);
        }
        
        // Test 4: Login with test user
        console.log('\n4️⃣ Testing login...');
        const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'testsupermarket@example.com',
                password: 'Test123!'
            })
        });
        
        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('✅ Login successful');
            console.log(`   User role: ${loginData.user?.role}`);
            
            // Test 5: Load store products
            console.log('\n5️⃣ Testing store products loading...');
            const storeProductsResponse = await fetch('http://localhost:3000/api/v1/products/store?page=1&limit=10', {
                headers: {
                    'Authorization': `Bearer ${loginData.token}`
                }
            });
            
            if (storeProductsResponse.ok) {
                const storeData = await storeProductsResponse.json();
                console.log(`✅ Store products loaded successfully`);
                console.log(`   Found ${storeData.products?.length || 0} products`);
                console.log(`   Pagination: ${JSON.stringify(storeData.pagination || {})}`);
            } else {
                console.log('❌ Failed to load store products');
            }
            
        } else {
            const errorData = await loginResponse.json();
            console.log('❌ Login failed:', errorData.message);
        }
        
        console.log('\n🎉 Server connection tests completed!');
        console.log('📱 The backend is ready for testing the improved loading states.');
        
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
    }
}

testServerConnection();
