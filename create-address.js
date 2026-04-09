const fetch = require('node-fetch');

async function createTestAddress() {
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
    
    // Create test address
    const addressResponse = await fetch('http://localhost:3000/api/v1/users/me/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Test Address',
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country',
        deliveryInstructions: 'Test instructions'
      })
    });
    
    const addressData = await addressResponse.json();
    
    if (addressResponse.ok) {
      console.log('Address created successfully!');
      console.log('Address ID:', addressData.id);
      return addressData.id;
    } else {
      console.error('Address creation failed:', addressData);
      return null;
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

createTestAddress();
