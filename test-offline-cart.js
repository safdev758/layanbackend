const fetch = require('node-fetch');

async function testOfflineCartOrder() {
  try {
    // Login as test customer
    const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testcustomer@example.com',
        password: 'Test123!'
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    console.log('✅ Customer login successful');
    
    // Create order with offline cart data (simulating mobile app)
    const orderResponse = await fetch('http://localhost:3000/api/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        deliveryAddressId: 'b8fdaa30-e7a1-4c9a-ab9e-bae7a2463467',
        paymentMethod: 'CASH',
        tip: 0,
        items: [
          {
            productId: 'a055708f-cc9e-4681-84be-b19aaa1f8821',
            quantity: 2,
            unitPrice: 2.99,
            selectedOptions: {}
          },
          {
            productId: '6af9ec3f-63ee-476f-9279-f83b4cc765c9',
            quantity: 1,
            unitPrice: 1.49,
            selectedOptions: {}
          }
        ],
        totalAmount: 7.47
      })
    });
    
    const orderData = await orderResponse.json();
    
    if (orderResponse.ok) {
      console.log('✅ Order created successfully with offline cart!');
      console.log('Order ID:', orderData.id);
      console.log('Total Amount:', orderData.totalAmount);
      console.log('Items count:', orderData.items ? orderData.items.length : 0);
      console.log('Status:', orderData.status);
      
      // Test empty cart validation
      console.log('\n🧪 Testing empty cart validation...');
      const emptyOrderResponse = await fetch('http://localhost:3000/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deliveryAddressId: 'b8fdaa30-e7a1-4c9a-ab9e-bae7a2463467',
          paymentMethod: 'CASH',
          tip: 0,
          items: [],
          totalAmount: 0
        })
      });
      
      const emptyOrderData = await emptyOrderResponse.json();
      
      if (!emptyOrderResponse.ok) {
        console.log('✅ Empty cart validation works:', emptyOrderData.message);
      } else {
        console.log('❌ Empty cart validation failed - should have been rejected');
      }
      
    } else {
      console.error('❌ Order creation failed:', orderData);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOfflineCartOrder();
