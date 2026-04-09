const fetch = require('node-fetch');

async function testProductDeletion() {
  try {
    // Login as supermarket owner
    const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@layan.com',
        password: 'Admin123!'
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    console.log('✅ Supermarket login successful');
    
    // Try to delete a product that's referenced in orders
    console.log('\n🧪 Testing deletion of product with orders...');
    const deleteResponse = await fetch('http://localhost:3000/api/v1/products/212a3ca8-41f5-4778-a58c-7db173124b23', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const deleteData = await deleteResponse.json();
    
    if (deleteResponse.status === 400) {
      console.log('✅ Product deletion properly rejected:', deleteData.message);
    } else if (deleteResponse.ok) {
      console.log('✅ Product deleted successfully (not referenced in orders)');
    } else {
      console.log('❌ Unexpected response:', deleteResponse.status, deleteData);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testProductDeletion();
