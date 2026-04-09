const fetch = require('node-fetch');

async function testOrderCreation() {
  try {
    // First login to get token
    const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@layan.com',
        password: 'Admin@123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    const token = loginData.token;
    
    if (!token) {
      throw new Error('Login failed');
    }
    
    console.log('Login successful, token:', token.substring(0, 50) + '...');
    
    // Get available addresses first
    const addressResponse = await fetch('http://localhost:3000/api/v1/users/me/addresses', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const addresses = await addressResponse.json();
    console.log('Available addresses:', addresses);
    
    if (!addresses || addresses.length === 0) {
      throw new Error('No addresses found');
    }
    
    // Create test order with items
    const orderResponse = await fetch('http://localhost:3000/api/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        deliveryAddressId: addresses[0].id,
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
      console.log('Order created successfully!');
      console.log('Order ID:', orderData.id);
      console.log('Total Amount:', orderData.totalAmount);
      console.log('Items count:', orderData.items ? orderData.items.length : 0);
    } else {
      console.error('Order creation failed:', orderData);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOrderCreation();
