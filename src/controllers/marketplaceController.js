const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { MarketplaceItem } = require('../entities/MarketplaceItem');
const { Thread } = require('../entities/Thread');
const { Message } = require('../entities/Message');
const { v4: uuidv4 } = require('uuid');
const { In } = require('typeorm');

// Get marketplace items
const getMarketplaceItems = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, query } = req.query;
  const itemRepo = AppDataSource.getRepository('MarketplaceItem');

  let queryBuilder = itemRepo.createQueryBuilder('item');

  if (query) {
    queryBuilder = queryBuilder.where('item.title ILIKE :query OR item.description ILIKE :query', {
      query: `%${query}%`
    });
  }

  queryBuilder = queryBuilder.orderBy('item.createdAt', 'DESC')
    .skip((page - 1) * limit)
    .take(limit);

  const [items, total] = await queryBuilder.getManyAndCount();

  res.json({
    data: {
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Create marketplace item
const createMarketplaceItem = asyncHandler(async (req, res) => {
  const { title, description, price, images } = req.body;
  const itemRepo = AppDataSource.getRepository('MarketplaceItem');

  const newItem = itemRepo.create({
    id: uuidv4(),
    title,
    description,
    price,
    images,
    ownerId: req.user.id, // Assign owner based on authenticated user
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await itemRepo.save(newItem);

  res.status(201).json({ data: newItem });
});

// Get marketplace item by ID
const getMarketplaceItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const itemRepo = AppDataSource.getRepository('MarketplaceItem');

  const item = await itemRepo.findOneBy({ id });

  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }

  res.json({ data: item });
});

// Create or get thread for an item
const createOrGetThread = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const threadRepo = AppDataSource.getRepository('Thread');
  const itemRepo = AppDataSource.getRepository('MarketplaceItem');

  // Get the marketplace item to find the seller
  const item = await itemRepo.findOneBy({ id: itemId });
  if (!item) {
    return res.status(404).json({ message: 'Marketplace item not found' });
  }

  if (item.ownerId === req.user.id) {
    return res.status(400).json({ message: 'Sellers cannot create a chat with themselves' });
  }

  // Find existing thread between this user and seller for this item
  let thread = await threadRepo.findOneBy({ 
    itemId, 
    userId: req.user.id,
    sellerId: item.ownerId 
  });

  if (!thread) {
    thread = threadRepo.create({
      id: uuidv4(),
      itemId,
      userId: req.user.id,
      sellerId: item.ownerId,
      createdAt: new Date()
    });

    await threadRepo.save(thread);
  }

  res.status(201).json({ data: thread });
});

// List all buyer conversations for a seller's item
const getItemThreadsForSeller = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const itemRepo = AppDataSource.getRepository('MarketplaceItem');
  const threadRepo = AppDataSource.getRepository('Thread');
  const messageRepo = AppDataSource.getRepository('Message');
  const userRepo = AppDataSource.getRepository('User');

  const item = await itemRepo.findOneBy({ id: itemId });
  if (!item) {
    return res.status(404).json({ message: 'Marketplace item not found' });
  }

  // Only item owner (seller) or admin can inspect all conversations for this item
  if (item.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const threads = await threadRepo.find({
    where: { itemId, sellerId: item.ownerId },
    order: { createdAt: 'DESC' }
  });

  if (threads.length === 0) {
    return res.json({ data: { threads: [] } });
  }

  const buyerIds = [...new Set(threads.map((t) => t.userId))];
  const buyers = await userRepo.find({
    where: { id: In(buyerIds) },
    select: ['id', 'name', 'profileImage']
  });
  const buyerMap = new Map(buyers.map((u) => [u.id, u]));

  const previewThreads = await Promise.all(
    threads.map(async (thread) => {
      const lastMessage = await messageRepo.findOne({
        where: { threadId: thread.id },
        order: { createdAt: 'DESC' }
      });
      const participant = buyerMap.get(thread.userId);

      return {
        id: thread.id,
        itemId: thread.itemId,
        userId: thread.userId,
        sellerId: thread.sellerId,
        createdAt: thread.createdAt,
        participant: participant
          ? {
              id: participant.id,
              name: participant.name,
              profileImage: participant.profileImage || null
            }
          : null,
        lastMessage: lastMessage || null
      };
    })
  );

  previewThreads.sort((a, b) => {
    const aDate = a.lastMessage?.createdAt || a.createdAt;
    const bDate = b.lastMessage?.createdAt || b.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  res.json({ data: { threads: previewThreads } });
});

// Get messages for a thread
const getThreadMessages = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const messageRepo = AppDataSource.getRepository('Message');
  const threadRepo = AppDataSource.getRepository('Thread');

  const thread = await threadRepo.findOneBy({ id: threadId });
  if (!thread) {
    return res.status(404).json({ message: 'Thread not found' });
  }

  // Verify user is part of this conversation
  if (thread.userId !== req.user.id && thread.sellerId !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const [messages, total] = await messageRepo.findAndCount({
    where: { threadId },
    order: { createdAt: 'ASC' },
    skip: (page - 1) * limit,
    take: limit
  });

  res.json({
    data: messages
  });
});

// Create a message in a thread
const createThreadMessage = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const { content } = req.body;
  const messageRepo = AppDataSource.getRepository('Message');
  const threadRepo = AppDataSource.getRepository('Thread');
  const userRepo = AppDataSource.getRepository('User');

  // Get thread to find the other party
  const thread = await threadRepo.findOneBy({ id: threadId });
  if (!thread) {
    return res.status(404).json({ message: 'Thread not found' });
  }

  // Verify user is part of this conversation
  if (thread.userId !== req.user.id && thread.sellerId !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const newMessage = messageRepo.create({
    id: uuidv4(),
    threadId,
    senderId: req.user.id,
    content,
    createdAt: new Date()
  });

  await messageRepo.save(newMessage);

  // Determine recipient (the other party in the conversation)
  const recipientId = thread.userId === req.user.id ? thread.sellerId : thread.userId;
  
  // Get sender info for notification
  const sender = await userRepo.findOneBy({ id: req.user.id });

  // Emit WebSocket chat event for users currently in this thread.
  if (req.wsService) {
    req.wsService.to(`chat:${threadId}`).emit('chat_message', {
      threadId,
      message: newMessage
    });
    // Also emit directly to recipient user room in case they are not joined to chat room.
    req.wsService.to(`user:${recipientId}`).emit('chat_message', {
      threadId,
      message: newMessage
    });
  }

  // Send push notification if recipient is offline
  // Note: Push notification service should be initialized in server.js
  if (req.pushService) {
    req.pushService.sendNewMessage(recipientId, newMessage, sender.name);
  }

  res.status(201).json({ data: newMessage });
});

module.exports = {
  getMarketplaceItems,
  createMarketplaceItem,
  getMarketplaceItemById,
  createOrGetThread,
  getItemThreadsForSeller,
  getThreadMessages,
  createThreadMessage
};
