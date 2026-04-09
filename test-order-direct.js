const fetch = require('node-fetch');

async function testOrderDirect() {
  try {
    // Login first
    const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@layan.com',
        password: 'Admin@123'
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    console.log('Login successful');
    
    // Create test order with hardcoded address ID
    const orderResponse = await fetch('http://localhost:3000/api/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        deliveryAddressId: '8fffd93e-ffa4-410c-8652-6b8cbb5b188e',
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
            quantity: 3,
            unitPrice: 1.49,
            selectedOptions: {}
          }
        ],
        totalAmount: 10.45
      })
    });
    
    const orderData = await orderResponse.json();
    
    if (orderResponse.ok) {
      console.log('✅ Order created successfully!');
      console.log('Order ID:', orderData.id);
      console.log('Total Amount:', orderData.totalAmount);
      console.log('Items count:', orderData.items ? orderData.items.length : 0);
      console.log('Items:', orderData.items);
    } else {
      console.error('❌ Order creation failed:', orderData);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOrderDirect();
