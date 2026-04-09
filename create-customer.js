const fetch = require('node-fetch');

async function createTestCustomer() {
  try {
    // Create new customer
    const signupResponse = await fetch('http://localhost:3000/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testcustomer@example.com',
        password: 'Test123!',
        name: 'Test Customer',
        phone: '+1234567890'
      })
    });
    
    const signupData = await signupResponse.json();
    
    if (signupResponse.ok) {
      console.log('✅ Customer created successfully!');
      console.log('User ID:', signupData.user.id);
      
      // Now login with the new customer
      const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testcustomer@example.com',
          password: 'Test123!'
        })
      });
      
      const loginData = await loginResponse.json();
      
      if (loginData.token) {
        console.log('✅ Customer login successful!');
        console.log('Token:', loginData.token.substring(0, 50) + '...');
        return loginData.token;
      }
    } else {
      console.error('❌ Customer creation failed:', signupData);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  return null;
}

createTestCustomer();
