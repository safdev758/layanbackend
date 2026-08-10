const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');

function resolveServiceAccount() {
  // 1) Inline JSON (Railway / production secrets)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  // 2) Explicit file path
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (configuredPath) {
    const absolute = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  }

  // 3) Default local file (gitignored)
  const defaultPath = path.resolve(__dirname, '../../firebase-service-account.json');
  if (fs.existsSync(defaultPath)) {
    return JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
  }

  return null;
}

function stringifyData(data = {}) {
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

class PushNotificationService {
  constructor() {
    this.initialized = false;
    this.initializeFirebase();
  }

  initializeFirebase() {
    try {
      const serviceAccount = resolveServiceAccount();
      if (!serviceAccount) {
        console.warn(
          '⚠️  Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or add firebase-service-account.json'
        );
        return;
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error.message);
    }
  }

  async sendToUser(userId, notification) {
    if (!this.initialized) {
      console.warn('Push notifications not initialized');
      return null;
    }

    try {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user || !user.fcmToken) {
        console.log(`No FCM token for user ${userId}`);
        return null;
      }

      if (user.preferences?.notifications === false) {
        console.log(`Notifications disabled for user ${userId}`);
        return null;
      }

      const channelId = notification.channelId || 'layan_default';
      const data = stringifyData({
        ...(notification.data || {}),
        title: notification.title,
        body: notification.body,
      });

      const message = {
        token: user.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId,
            clickAction: notification.clickAction || 'OPEN_APP',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: notification.badge || 1,
              category: notification.category,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('✅ Push notification sent:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to send push notification:', error);

      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        const userRepo = AppDataSource.getRepository(User);
        await userRepo.update(userId, { fcmToken: null });
      }

      return null;
    }
  }

  async sendToUsers(userIds, notification) {
    const unique = [...new Set((userIds || []).filter(Boolean))];
    return Promise.all(unique.map((id) => this.sendToUser(id, notification)));
  }

  async sendOrderUpdate(userId, order) {
    const statusMessages = {
      CONFIRMED: 'Your order has been confirmed!',
      PREPARING: 'Your order is being prepared!',
      OUT_FOR_DELIVERY: 'Your order is out for delivery!',
      DELIVERED: 'Your order has been delivered!',
      CANCELLED: 'Your order has been cancelled.',
    };

    return this.sendToUser(userId, {
      title: 'Order Update',
      body: statusMessages[order.status] || 'Your order status has been updated',
      data: {
        type: 'order_update',
        orderId: order.id,
        status: order.status,
        screen: 'OrderDetails',
      },
      clickAction: 'ORDER_DETAILS',
      category: 'ORDER_UPDATE',
      channelId: 'layan_orders',
    });
  }

  async sendNewOrderToStore(storeId, order) {
    if (!storeId) return null;
    return this.sendToUser(storeId, {
      title: 'New order',
      body: `Order #${order.trackingNumber || String(order.id).substring(0, 8)} — ${order.totalAmount} DA`,
      data: {
        type: 'new_order',
        orderId: order.id,
        screen: 'Orders',
      },
      clickAction: 'VIEW_ORDERS',
      category: 'NEW_ORDER',
      channelId: 'layan_orders',
    });
  }

  async sendNewMessage(userId, message, senderName) {
    const body =
      typeof message.content === 'string'
        ? message.content.substring(0, 100)
        : 'You have a new message';

    return this.sendToUser(userId, {
      title: `New message from ${senderName || 'Layan'}`,
      body,
      data: {
        type: 'new_message',
        threadId: message.threadId,
        messageId: message.id,
        screen: 'Chat',
      },
      clickAction: 'OPEN_CHAT',
      category: 'MESSAGE',
      channelId: 'layan_messages',
    });
  }

  async sendDeliveryRequest(driverId, order) {
    return this.sendToUser(driverId, {
      title: 'New Delivery Available',
      body: `Order #${order.trackingNumber || String(order.id).substring(0, 8)} - ${order.totalAmount} DA`,
      data: {
        type: 'delivery_available',
        orderId: order.id,
        amount: String(order.totalAmount ?? ''),
        screen: 'AvailableDeliveries',
      },
      clickAction: 'VIEW_DELIVERY',
      category: 'DELIVERY',
      channelId: 'layan_deliveries',
    });
  }

  async sendDriverAssigned(userId, order, driverName) {
    return this.sendToUser(userId, {
      title: 'Driver assigned',
      body: `${driverName || 'A driver'} accepted your order`,
      data: {
        type: 'driver_assigned',
        orderId: order.id,
        screen: 'OrderDetails',
      },
      clickAction: 'ORDER_DETAILS',
      category: 'ORDER_UPDATE',
      channelId: 'layan_orders',
    });
  }

  async notifyDriversNewDelivery(order) {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const drivers = await userRepo.find({
        where: { role: 'DRIVER', status: 'ACTIVE' },
        select: ['id', 'fcmToken'],
      });
      const withToken = drivers.filter((d) => d.fcmToken).map((d) => d.id);
      if (!withToken.length) return [];
      return this.sendToUsers(withToken, {
        title: 'New Delivery Available',
        body: `Order #${order.trackingNumber || String(order.id).substring(0, 8)} - ${order.totalAmount} DA`,
        data: {
          type: 'delivery_available',
          orderId: order.id,
          amount: String(order.totalAmount ?? ''),
          screen: 'AvailableDeliveries',
        },
        clickAction: 'VIEW_DELIVERY',
        category: 'DELIVERY',
        channelId: 'layan_deliveries',
      });
    } catch (error) {
      console.error('❌ Failed to notify drivers:', error.message);
      return [];
    }
  }

  async registerToken(userId, token, platform = 'fcm') {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const updateData =
        platform === 'apns' ? { apnsToken: token } : { fcmToken: token };

      await userRepo.update(userId, updateData);
      console.log(`✅ ${platform.toUpperCase()} token registered for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to register token:', error);
      return false;
    }
  }

  async unregisterToken(userId, platform = 'fcm') {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const updateData =
        platform === 'apns' ? { apnsToken: null } : { fcmToken: null };

      await userRepo.update(userId, updateData);
      console.log(`✅ ${platform.toUpperCase()} token unregistered for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to unregister token:', error);
      return false;
    }
  }
}

module.exports = new PushNotificationService();
