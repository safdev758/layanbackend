const dotenv = require('dotenv');
dotenv.config();

console.log('All environment variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('SECRET_KEY:', process.env.SECRET_KEY);
console.log('NODE_ENV:', process.env.NODE_ENV);
