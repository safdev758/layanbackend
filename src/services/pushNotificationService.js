const admin = require('firebase-admin');
const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');

class PushNotificationService {
  constructor() {
    this.initialized = false;
    this.initializeFirebase();
  }

  initializeFirebase() {
    try {
      // Initialize Firebase Admin SDK
      // You need to download your Firebase service account key JSON
      // and set the path in environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        }
        this.initialized = true;
        console.log('✅ Firebase Admin SDK initialized');
      } else {
        console.warn('⚠️  Firebase service account not configured. Push notifications disabled.');
      }
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

      const message = {
        token: user.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: notification.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
            channelId: notification.channelId || 'default',
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
      
      // If token is invalid, clear it from database
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        const userRepo = AppDataSource.getRepository(User);
        await userRepo.update(userId, { fcmToken: null });
      }
      
      return null;
    }
  }

  async sendOrderUpdate(userId, order) {
    const statusMessages = {
      'CONFIRMED': 'Your order has been confirmed!',
      'OUT_FOR_DELIVERY': 'Your order is out for delivery!',
      'DELIVERED': 'Your order has been delivered!',
      'CANCELLED': 'Your order has been cancelled.',
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
    });
  }

  async sendNewMessage(userId, message, senderName) {
    return this.sendToUser(userId, {
      title: `New message from ${senderName}`,
      body: message.content.substring(0, 100),
      data: {
        type: 'new_message',
        threadId: message.threadId,
        messageId: message.id,
        screen: 'Chat',
      },
      clickAction: 'OPEN_CHAT',
      category: 'MESSAGE',
    });
  }

  async sendDeliveryRequest(driverId, order) {
    return this.sendToUser(driverId, {
      title: 'New Delivery Available',
      body: `Order #${order.trackingNumber || order.id.substring(0, 8)} - $${order.totalAmount}`,
      data: {
        type: 'delivery_available',
        orderId: order.id,
        amount: order.totalAmount.toString(),
        screen: 'AvailableDeliveries',
      },
      clickAction: 'VIEW_DELIVERY',
      category: 'DELIVERY',
    });
  }

  async registerToken(userId, token, platform = 'fcm') {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const updateData = platform === 'apns' 
        ? { apnsToken: token }
        : { fcmToken: token };
      
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
      const updateData = platform === 'apns'
        ? { apnsToken: null }
        : { fcmToken: null };
      
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