const fetch = require('node-fetch');

async function testCompleteFlow() {
  try {
    // Login as customer
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
    
    // Create address for customer
    const addressResponse = await fetch('http://localhost:3000/api/v1/users/me/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Home',
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country',
        deliveryInstructions: 'Ring the doorbell'
      })
    });
    
    const addressData = await addressResponse.json();
    
    if (addressResponse.ok) {
      console.log('✅ Address created successfully!');
      console.log('Address ID:', addressData.id);
      
      // Create test order with items
      const orderResponse = await fetch('http://localhost:3000/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deliveryAddressId: addressData.id,
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
        console.log('Status:', orderData.status);
        
        // Now test getting orders to see if they display correctly
        const getOrdersResponse = await fetch('http://localhost:3000/api/v1/orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const ordersData = await getOrdersResponse.json();
        console.log('\n📋 Retrieved orders:');
        ordersData.orders.forEach(order => {
          console.log(`- Order ${order.id}: ${order.totalAmount} (${order.items?.length || 0} items)`);
        });
        
      } else {
        console.error('❌ Order creation failed:', orderData);
      }
      
    } else {
      console.error('❌ Address creation failed:', addressData);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCompleteFlow();
