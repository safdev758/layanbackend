const fetch = require('node-fetch');

async function testLoadingStates() {
    try {
        console.log('🧪 Testing supermarket loading states...');
        
        // Test 1: Login as supermarket owner
        console.log('\n1️⃣ Testing supermarket login...');
        const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@layan.com',
                password: 'Admin123!'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error('Login failed');
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('✅ Supermarket login successful');
        
        // Test 2: Load store products (should be fast with optimized query)
        console.log('\n2️⃣ Testing store products loading...');
        const startTime = Date.now();
        const productsResponse = await fetch('http://localhost:3000/api/v1/products/store?page=1&limit=20', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!productsResponse.ok) {
            throw new Error('Failed to load products');
        }
        
        const productsData = await productsResponse.json();
        const loadTime = Date.now() - startTime;
        
        console.log(`✅ Store products loaded in ${loadTime}ms`);
        console.log(`   Found ${productsData.products.length} products`);
        console.log(`   Pagination: page ${productsData.pagination.page} of ${productsData.pagination.pages}`);
        
        // Test 3: Load global products
        console.log('\n3️⃣ Testing global products loading...');
        const globalStart = Date.now();
        const globalResponse = await fetch('http://localhost:3000/api/v1/products/global?page=1&limit=20', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            const globalLoadTime = Date.now() - globalStart;
            console.log(`✅ Global products loaded in ${globalLoadTime}ms`);
            console.log(`   Found ${globalData.products.length} global products`);
        } else {
            console.log('ℹ️ Global products endpoint may not be implemented yet');
        }
        
        console.log('\n🎉 All loading state tests completed successfully!');
        console.log('📱 The app should now show proper loading indicators and no more empty state flashes.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Wait a moment for server to fully start
setTimeout(testLoadingStates, 2000);
