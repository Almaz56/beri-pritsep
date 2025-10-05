import logger from '../utils/logger';

export interface ChatMessage {
  id: string;
  userId: string;
  adminId?: string;
  message: string;
  type: 'USER' | 'ADMIN' | 'SYSTEM';
  timestamp: Date;
  isRead: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  adminId?: string;
  status: 'OPEN' | 'CLOSED' | 'WAITING';
  subject?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  messages: ChatMessage[];
}

class ChatService {
  private sessions = new Map<string, ChatSession>();
  private messages = new Map<string, ChatMessage>();

  /**
   * Create new chat session
   */
  public createSession(userId: string, subject?: string, priority: ChatSession['priority'] = 'MEDIUM'): ChatSession {
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ChatSession = {
      id: sessionId,
      userId,
      status: 'OPEN',
      subject,
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };

    this.sessions.set(sessionId, session);
    
    // Add system message
    this.addMessage(sessionId, 'SYSTEM', 'Чат поддержки создан. Ожидайте ответа администратора.');
    
    logger.info('Chat session created:', { sessionId, userId, subject, priority });
    
    return session;
  }

  /**
   * Add message to chat session
   */
  public addMessage(sessionId: string, type: ChatMessage['type'], message: string, adminId?: string): ChatMessage {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const chatMessage: ChatMessage = {
      id: messageId,
      userId: type === 'USER' ? session.userId : (adminId || 'system'),
      adminId: type === 'ADMIN' ? adminId : undefined,
      message,
      type,
      timestamp: new Date(),
      isRead: false
    };

    this.messages.set(messageId, chatMessage);
    session.messages.push(chatMessage);
    session.updatedAt = new Date();
    session.lastMessageAt = new Date();

    // Update session status
    if (type === 'USER' && session.status === 'WAITING') {
      session.status = 'OPEN';
    } else if (type === 'ADMIN' && session.status === 'OPEN') {
      session.status = 'WAITING';
    }

    logger.info('Message added to chat:', { sessionId, messageId, type, messageLength: message.length });
    
    return chatMessage;
  }

  /**
   * Get chat session by ID
   */
  public getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get user's chat sessions
   */
  public getUserSessions(userId: string): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Get all open chat sessions (for admin)
   */
  public getOpenSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.status === 'OPEN' || session.status === 'WAITING')
      .sort((a, b) => {
        // Sort by priority first, then by last message time
        const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return (b.lastMessageAt || b.updatedAt).getTime() - (a.lastMessageAt || a.updatedAt).getTime();
      });
  }

  /**
   * Assign admin to chat session
   */
  public assignAdmin(sessionId: string, adminId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.adminId = adminId;
    session.updatedAt = new Date();
    
    this.addMessage(sessionId, 'SYSTEM', `Администратор ${adminId} подключился к чату.`);
    
    logger.info('Admin assigned to chat:', { sessionId, adminId });
    
    return true;
  }

  /**
   * Close chat session
   */
  public closeSession(sessionId: string, adminId?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'CLOSED';
    session.updatedAt = new Date();
    
    this.addMessage(sessionId, 'SYSTEM', 'Чат закрыт.');
    
    logger.info('Chat session closed:', { sessionId, adminId });
    
    return true;
  }

  /**
   * Mark messages as read
   */
  public markAsRead(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Mark all messages as read for the user
    session.messages.forEach(message => {
      if (message.type !== 'USER' || message.userId === userId) {
        message.isRead = true;
      }
    });

    logger.info('Messages marked as read:', { sessionId, userId });
    
    return true;
  }

  /**
   * Get unread message count for user
   */
  public getUnreadCount(userId: string): number {
    let unreadCount = 0;
    
    this.sessions.forEach(session => {
      if (session.userId === userId) {
        session.messages.forEach(message => {
          if (message.type !== 'USER' && !message.isRead) {
            unreadCount++;
          }
        });
      }
    });
    
    return unreadCount;
  }

  /**
   * Get chat statistics
   */
  public getStats(): {
    totalSessions: number;
    openSessions: number;
    closedSessions: number;
    waitingSessions: number;
    totalMessages: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const messages = Array.from(this.messages.values());
    
    return {
      totalSessions: sessions.length,
      openSessions: sessions.filter(s => s.status === 'OPEN').length,
      closedSessions: sessions.filter(s => s.status === 'CLOSED').length,
      waitingSessions: sessions.filter(s => s.status === 'WAITING').length,
      totalMessages: messages.length
    };
  }

  /**
   * Search chat sessions
   */
  public searchSessions(query: string, adminId?: string): ChatSession[] {
    const sessions = Array.from(this.sessions.values());
    
    return sessions.filter(session => {
      // Filter by admin if specified
      if (adminId && session.adminId !== adminId) {
        return false;
      }
      
      // Search in subject and messages
      const searchText = query.toLowerCase();
      
      if (session.subject && session.subject.toLowerCase().includes(searchText)) {
        return true;
      }
      
      return session.messages.some(message => 
        message.message.toLowerCase().includes(searchText)
      );
    }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}

export const chatService = new ChatService();
