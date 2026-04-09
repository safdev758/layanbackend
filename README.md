# LAYAN E-commerce Backend

A comprehensive e-commerce backend API built with Node.js, Express, TypeORM, and PostgreSQL. This backend supports a multi-role marketplace with customers, supermarkets, drivers, and administrators.

## Features

- **Multi-role Authentication**: Customer, Supermarket, Driver, and Admin roles
- **Product Management**: Full CRUD operations for products with categories, reviews, and ratings
- **Shopping Cart**: Server-side cart management with real-time updates
- **Order Management**: Complete order lifecycle from creation to delivery
- **Real-time Tracking**: WebSocket-based delivery tracking with live location updates
- **Review System**: Product reviews and ratings with helpful voting
- **Advanced Search**: Full-text search with filters and suggestions
- **Address Management**: Multiple delivery addresses per user
- **Driver Management**: Driver assignment, earnings tracking, and location sharing
- **Role-based Access Control**: Secure endpoints with proper authorization

## API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /signup` - Create new user account
- `POST /login` - User login
- `POST /logout` - User logout (requires auth)
- `POST /refresh` - Refresh JWT token
- `POST /forgot-password` - Send password reset OTP
- `POST /verify-otp` - Verify OTP code
- `POST /reset-password` - Reset password with OTP

### Users (`/api/v1/users`)
- `GET /me` - Get current user profile (requires auth)
- `PUT /me` - Update current user profile (requires auth)
- `GET /:id` - Get user by ID (requires auth)
- `POST /me/addresses` - Add new address (requires auth)
- `PUT /me/addresses/:addressId` - Update address (requires auth)
- `DELETE /me/addresses/:addressId` - Delete address (requires auth)

- `POST /me/favorites` - Add product to favorites (requires auth)
- `DELETE /me/favorites/:productId` - Remove from favorites (requires auth)

### Categories (`/api/v1/categories`)
- `GET /` - Get all categories (public)
- `GET /:id` - Get category by ID (public)
- `GET /:id/products` - Get products in category (public)
- `POST /` - Create category (Admin only)
- `PUT /:id` - Update category (Admin only)
- `DELETE /:id` - Delete category (Admin only)

### Products (`/api/v1/products`)
- `GET /` - Get products with filtering and pagination (public)
- `GET /:id` - Get product by ID with reviews (public)
- `POST /` - Create product (Supermarket only)
- `PUT /:id` - Update product (Supermarket only)
- `DELETE /:id` - Delete product (Supermarket only)

### Cart (`/api/v1/cart`)
- `GET /` - Get current user's cart (requires auth)
- `POST /items` - Add item to cart (requires auth)
- `PUT /items/:productId` - Update cart item (requires auth)
- `DELETE /items/:productId` - Remove item from cart (requires auth)
- `POST /clear` - Clear cart (requires auth)

### Orders (`/api/v1/orders`)
- `POST /` - Create order from cart (Customer only)
- `GET /` - Get user's orders (requires auth)
- `GET /:id` - Get order by ID (requires auth)
- `PUT /:id/status` - Update order status (role-based)
- `POST /:id/assign-driver` - Assign driver to order (Supermarket/Admin)
- `POST /:id/share-location` - Share driver location (Driver only)
- `POST /:id/cancel` - Cancel order (Customer/Supermarket/Admin)

### Drivers (`/api/v1/drivers`)
- `GET /:driverId/available-deliveries` - Get available deliveries (Driver only)
- `POST /:driverId/accept-delivery` - Accept delivery (Driver only)
- `POST /:driverId/update-location` - Update driver location (Driver only)
- `GET /:driverId/earnings` - Get driver earnings (Driver only)
- `GET /:driverId/orders` - Get driver's orders (Driver only)
- `POST /:driverId/update-delivery-status` - Update delivery status (Driver only)

### Reviews (`/api/v1/reviews`)
- `POST /:productId` - Create product review (requires auth)
- `GET /:productId` - Get product reviews (public)
- `PUT /:reviewId` - Update review (author only)
- `DELETE /:reviewId` - Delete review (author only)
- `POST /:reviewId/helpful` - Mark review as helpful (public)
- `GET /user/:userId` - Get user's reviews (requires auth)

### Search (`/api/v1/search`)
- `GET /` - Global search across products and categories
- `GET /products` - Search products only
- `GET /suggestions` - Get search suggestions
- `GET /trending` - Get trending searches
- `POST /advanced` - Advanced search with filters

## WebSocket Events

### Client Events
- `authenticate` - Authenticate WebSocket connection
- `join_order` - Join order tracking room
- `leave_order` - Leave order tracking room

### Server Events
- `order:update` - Order status or details updated
- `driver:location` - Driver location update
- `product:update` - Product information updated
- `notification` - General notification
- `order:new` - New order created (Supermarkets)
- `delivery:available` - New delivery available (Drivers)

## Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: Customer, Supermarket, Driver, Admin roles
- **Products**: With categories, reviews, stock management
- **Orders**: Complete order lifecycle tracking
- **Cart**: Server-side cart storage
- **Addresses**: User delivery addresses
- **Reviews**: Product reviews and ratings
- **Driver Trips**: Delivery tracking and driver management

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (see `env.example`)
4. Run database migration and start server:
   ```bash
   npm run start:migrate
   ```
   
   Or run migration separately:
   ```bash
   npm run migrate
   npm start
   ```

## Environment Variables

```env
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
SECRET_KEY=your_jwt_secret_key
NODE_ENV=development
```

## API Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "data": { ... },
  "message": "Success message",
  "pagination": { ... } // For paginated responses
}
```

### Error Response
```json
{
  "message": "Error message",
  "error": "Error details"
}
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Role-based Access Control

- **CUSTOMER**: Can create orders, manage cart, write reviews
- **SUPERMARKET**: Can manage products, view store orders, assign drivers
- **DRIVER**: Can accept deliveries, update location, manage delivery status
- **ADMIN**: Full access to all resources

## Real-time Features

The application includes WebSocket support for:
- Live order tracking
- Driver location updates
- Real-time notifications
- Order status updates

## Database Features

- UUID primary keys for all entities
- Full-text search on product names and descriptions
- Automatic rating calculation triggers
- Audit logging with events table
- Optimized indexes for performance

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Input validation and sanitization
- SQL injection protection through TypeORM

## Performance Optimizations

- Database indexing for common queries
- Pagination for large result sets
- Efficient full-text search
- Optimized WebSocket connections
- Connection pooling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
# layanbackend
# layanbackend
# layanbackend
# layanbackend
