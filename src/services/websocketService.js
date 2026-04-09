const jwt = require('jsonwebtoken');
const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');
const WebSocket = require('ws');

class WebSocketService {
  constructor(wss) {
    this.wss = wss;
    this.rooms = new Map(); // Map<roomName, Set<WebSocket>>
    this.clients = new Map(); // Map<WebSocket, { userId, role, rooms: Set<string> }>
    this.maxPayloadSize = 50 * 1024 * 1024; // 50MB max payload

    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      this.clients.set(ws, { rooms: new Set() });

      ws.on('message', async (message) => {
        try {
          if (message.length > this.maxPayloadSize) {
            console.log(`[WebSocket] Message too large: ${message.length} bytes`);
            this.send(ws, { type: 'error', message: 'Message payload too large' });
            return;
          }

          let data;
          try {
            data = JSON.parse(message);
          } catch (e) {
            console.error('Failed to parse message:', e);
            return;
          }

          // Handle "handshake" or "authenticate"
          // AppStateWithApi.kt sends: { type: "authenticate", token: "..." } ??
          // Actually checking mobile app implementation: 
          // It sends: WebSocketEvent.Authenticate(token) which serializes to { type: "authenticate", token: "..." } (polymorphic)
          // Wait, kotlinx.serialization defaults might include module name unless configured. 
          // Let's assume standard JSON structure based on common usage.

          const messageType = this.resolveMessageType(data);

          if (messageType === 'authenticate') {
            await this.handleAuthentication(ws, data);
          } else if (messageType === 'join_order' || messageType === 'JoinOrder') { // Checking polymorphic serialization
            this.handleJoinOrder(ws, data);
          } else if (messageType === 'leave_order' || messageType === 'LeaveOrder') {
            this.handleLeaveOrder(ws, data);
          } else if (messageType === 'join_chat') {
            this.handleJoinChat(ws, data);
          } else if (messageType === 'leave_chat') {
            this.handleLeaveChat(ws, data);
          } else if (messageType === 'chat_message') {
            // Handle incoming chat if needed, though mostly handled via REST
          }

        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
      });
    });
  }

  resolveMessageType(data) {
    if (!data || typeof data !== 'object') return '';
    if (typeof data.type === 'string' && data.type.trim() !== '') {
      return data.type;
    }

    // Backward-compatible fallbacks for clients that omit the discriminator field.
    if (typeof data.token === 'string' && data.token.trim() !== '') {
      return 'authenticate';
    }

    if (typeof data.orderId === 'string' && data.orderId.trim() !== '') {
      return data.action === 'leave' || data.leave === true ? 'leave_order' : 'join_order';
    }

    if (typeof data.threadId === 'string' && data.threadId.trim() !== '') {
      if (data.action === 'leave' || data.leave === true) return 'leave_chat';
      if (typeof data.content === 'string') return 'chat_message';
      if (data.message && typeof data.message === 'object') return 'chat_message';
      return 'join_chat';
    }

    return '';
  }

  async handleAuthentication(ws, data) {
    try {
      const token = data.token;
      if (!token) {
        this.send(ws, { type: 'auth_error', message: 'No token provided' });
        return;
      }

      const decoded = jwt.verify(token, process.env.SECRET_KEY || 'dev_secret');
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: decoded.id } });

      if (!user) {
        this.send(ws, { type: 'auth_error', message: 'User not found' });
        return;
      }

      const clientInfo = this.clients.get(ws);
      clientInfo.userId = user.id;
      clientInfo.role = user.role;

      // Join user specific room
      this.joinRoom(ws, `user:${user.id}`);

      // Join role specific room
      this.joinRoom(ws, `role:${user.role}`);

      this.send(ws, {
        type: 'authenticated',
        userId: user.id,
        role: user.role,
        message: 'Successfully authenticated'
      });

      console.log(`User ${user.id} (${user.role}) authenticated via WS`);
    } catch (error) {
      console.error('Authentication error:', error);
      this.send(ws, { type: 'auth_error', message: 'Invalid token' });
    }
  }

  handleJoinOrder(ws, data) {
    const { orderId } = data;
    if (orderId && this.clients.get(ws).userId) {
      this.joinRoom(ws, `order:${orderId}`);
      this.send(ws, { type: 'joined_order', orderId });
    }
  }

  handleLeaveOrder(ws, data) {
    const { orderId } = data;
    if (orderId) {
      this.leaveRoom(ws, `order:${orderId}`);
      this.send(ws, { type: 'left_order', orderId });
    }
  }

  handleJoinChat(ws, data) {
    const { threadId } = data;
    if (threadId && this.clients.get(ws).userId) {
      this.joinRoom(ws, `chat:${threadId}`);
    }
  }

  handleLeaveChat(ws, data) {
    const { threadId } = data;
    if (threadId) {
      this.leaveRoom(ws, `chat:${threadId}`);
    }
  }

  handleDisconnect(ws) {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      // Remove from all rooms
      for (const room of clientInfo.rooms) {
        this.leaveRoom(ws, room);
      }
      this.clients.delete(ws);
      console.log('Client disconnected');
    }
  }

  // Room Management
  joinRoom(ws, room) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(ws);

    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      clientInfo.rooms.add(room);
    }
  }

  leaveRoom(ws, room) {
    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(ws);
      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }
    }

    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      clientInfo.rooms.delete(room);
    }
  }

  // Messaging Helper
  send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  to(room) {
    return {
      emit: (type, data) => {
        const payload = { type, ...data };
        if (!this.validatePayloadSize(payload)) return;

        const sockets = this.rooms.get(room);
        if (sockets) {
          const messageStr = JSON.stringify(payload);
          for (const ws of sockets) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(messageStr);
            }
          }
        }
      }
    };
  }

  // Shim for global broadcast used in some places (though usually it's to(room))
  emit(type, data) {
    const payload = { type, ...data };
    // Broadcast to all connected clients
    const messageStr = JSON.stringify(payload);
    for (const ws of this.wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  // Data Sanitization (kept from original)
  sanitizeData(data) {
    if (!data) return data;
    const sanitized = { ...data };

    if (sanitized.images && Array.isArray(sanitized.images)) {
      sanitized.images = sanitized.images.map(image => {
        if (typeof image === 'string' && image.startsWith('data:image/')) {
          if (image.length > 100) return '[Base64 image data removed for WebSocket]';
        }
        return image;
      });
    }

    if (sanitized.imageUrl && typeof sanitized.imageUrl === 'string' && sanitized.imageUrl.startsWith('data:image/')) {
      if (sanitized.imageUrl.length > 100) sanitized.imageUrl = '[Base64 image data removed for WebSocket]';
    }

    if (sanitized.image && typeof sanitized.image === 'string' && sanitized.image.startsWith('data:image/')) {
      if (sanitized.image.length > 100) sanitized.image = '[Base64 image data removed for WebSocket]';
    }

    return sanitized;
  }

  validatePayloadSize(data) {
    try {
      const dataSize = JSON.stringify(data).length;
      if (dataSize > this.maxPayloadSize) {
        console.warn(`[WebSocket] Payload too large: ${dataSize} bytes`);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[WebSocket] Error validation payload size:', error);
      return false;
    }
  }

  // API Methods matching original interface
  broadcastOrderUpdate(orderId, updateData) {
    this.to(`order:${orderId}`).emit('order_update', {
      orderId,
      ...updateData,
      timestamp: new Date().toISOString()
    });
  }

  broadcastDriverLocation(orderId, locationData) {
    this.to(`order:${orderId}`).emit('driver_location', {
      orderId,
      ...locationData,
      timestamp: new Date().toISOString()
    });
  }

  broadcastProductUpdate(productId, updateData) {
    const sanitizedData = this.sanitizeData(updateData);
    const message = {
      productId,
      ...sanitizedData,
      timestamp: new Date().toISOString(),
      updateType: sanitizedData.hasImageUpdate ? 'image_update' : 'data_update'
    };

    if (!this.validatePayloadSize(message)) {
      // Fallback minimal
      this.emit('product_update', {
        productId,
        message: 'Product updated (minimal)',
        timestamp: new Date().toISOString()
      });
      return;
    }
    this.emit('product_update', message);
  }

  broadcastProductLoadingState(productId, isLoading, operation = 'update') {
    this.emit('product_loading', {
      productId,
      isLoading,
      operation,
      timestamp: new Date().toISOString()
    });
  }

  sendNotificationToUser(userId, notification) {
    this.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  sendNotificationToRole(role, notification) {
    this.to(`role:${role}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  broadcastNewOrder(orderData) {
    this.to('role:SUPERMARKET').emit('order_new', {
      ...orderData,
      timestamp: new Date().toISOString()
    });
  }

  broadcastAvailableDelivery(orderData) {
    this.to('role:DRIVER').emit('delivery_available', {
      ...orderData,
      timestamp: new Date().toISOString()
    });
  }

  broadcastCustomerLocation(orderId, locationData) {
    this.to(`order:${orderId}`).emit('customer_location', {
      orderId,
      ...locationData,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = WebSocketService;
