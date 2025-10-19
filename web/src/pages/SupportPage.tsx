import React, { useState, useEffect, useRef } from 'react';
import { supportApi, SupportChat, SupportMessage, getAuthToken } from '../api';
import { io, Socket } from 'socket.io-client';
import { getTelegramWebApp } from '../telegram';
import './SupportPage.css';

const SupportPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [chat, setChat] = useState<SupportChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
    
    // Use Telegram WebApp API to expand
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp) {
      telegramWebApp.expand();
    }
    
    // Scroll to bottom to ensure input is visible
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };


  const playNotificationSound = () => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set typing indicator
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      if (socketRef.current && chat) {
        socketRef.current.emit('typing-start', { chatId: chat.id });
      }
    }
    
    // Clear typing indicator after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socketRef.current && chat) {
        socketRef.current.emit('typing-stop', { chatId: chat.id });
      }
    }, 2000);
  };

  const connectWebSocket = () => {
    if (!token || socketRef.current) return;

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
    const WS_URL = API_BASE_URL.replace('/api', '');

    socketRef.current = io(WS_URL, {
      auth: {
        token: token
      }
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 WebSocket connected');
    });

    socketRef.current.on('new-message', (message: SupportMessage) => {
      console.log('📨 New message received:', message);
      
      // Don't update if user is typing
      if (isTyping || newMessage.trim()) {
        return;
      }
      
      // Don't update if it's a user message (we already have it locally)
      if (message.senderType === 'USER') {
        console.log('🚫 Blocking update - user message already exists locally');
        return;
      }
      
      const now = Date.now();
      const timeSinceLastUpdate = now - lastMessageTimeRef.current;
      
      // Debounce updates - only update if more than 500ms passed since last update
      if (timeSinceLastUpdate < 500) {
        return;
      }
      
      lastMessageTimeRef.current = now;
      
      setChat(prevChat => {
        if (!prevChat) return prevChat;
        
        // Check if message already exists to avoid duplicates
        const messageExists = prevChat.messages?.some(m => 
          m.id === message.id || 
          (m.id.toString().startsWith('temp-') && m.content === message.content && m.senderType === message.senderType)
        );
        if (messageExists) return prevChat;
        
        // Play notification sound for incoming messages (not from current user)
        if (message.senderType === 'ADMIN') {
          playNotificationSound();
        }
        
        return {
          ...prevChat,
          messages: [...(prevChat.messages || []), message]
        };
      });
      // Auto-scroll to new message
      setTimeout(scrollToBottom, 100);
    });

    socketRef.current.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    // Handle typing indicators
    socketRef.current.on('typing-start', (data: any) => {
      console.log('⌨️ Admin started typing:', data);
      if (chat && chat.id === data.chatId) {
        setChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            isAdminTyping: true
          };
        });
      }
    });

    socketRef.current.on('typing-stop', (data: any) => {
      console.log('⌨️ Admin stopped typing:', data);
      if (chat && chat.id === data.chatId) {
        setChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            isAdminTyping: false
          };
        });
      }
    });
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const joinChatRoom = (chatId: number) => {
    if (socketRef.current) {
      socketRef.current.emit('join-support-chat', chatId);
    }
  };

  const leaveChatRoom = (chatId: number) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-support-chat', chatId);
    }
  };

  useEffect(() => {
    // Initialize Telegram WebApp
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp) {
      telegramWebApp.ready();
      // Configure the WebApp for better UX
      telegramWebApp.expand();
    }

    if (token) {
      connectWebSocket();
      loadChat();
    } else {
      setError('Необходимо авторизоваться');
      setLoading(false);
    }


    // Handle viewport changes when keyboard appears/disappears
    const handleResize = () => {
      // Scroll to bottom when viewport changes (keyboard appears/disappears)
      setTimeout(scrollToBottom, 100);
    };

    // iOS specific keyboard detection
    const handleIOSKeyboard = () => {
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        const initialViewportHeight = window.innerHeight;
        
        const checkKeyboard = () => {
          const currentHeight = window.innerHeight;
          const heightDifference = initialViewportHeight - currentHeight;
          
          if (heightDifference > 150) {
            // Keyboard is visible
            setIsInputFocused(true);
            document.body.classList.add('hide-navigation');
          } else {
            // Keyboard is hidden
            setIsInputFocused(false);
            document.body.classList.remove('hide-navigation');
          }
        };

        // Check on resize (iOS keyboard events)
        window.addEventListener('resize', checkKeyboard);
        
        return () => {
          window.removeEventListener('resize', checkKeyboard);
        };
      }
      return () => {};
    };

    const cleanupIOS = handleIOSKeyboard();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      disconnectWebSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      // Clean up iOS keyboard detection
      cleanupIOS();
    };
  }, [token]);

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages]);

  // Убираем автообновление - оно мешает пользователю
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     if (token && chat) {
  //       loadChat();
  //     }
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, [token, chat]);

  const loadChat = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await supportApi.getSupportChats(token);
      
      if (response.success && response.data) {
        setChat(response.data);
        // Join WebSocket room for this chat
        joinChatRoom(response.data.id);
      } else {
        setError(response.error || 'Ошибка загрузки чата');
      }
    } catch (err) {
      setError('Ошибка загрузки чата');
      console.error('Error loading chat:', err);
    } finally {
      setLoading(false);
    }
  };

  const createChat = async () => {
    if (!token) return;
    
    try {
      const response = await supportApi.createSupportChat(token, {});
      
      if (response.success && response.data) {
        setChat(response.data);
        setError(null);
        // Join WebSocket room for this chat
        joinChatRoom(response.data.id);
      } else {
        setError(response.error || 'Ошибка создания чата');
      }
    } catch (err) {
      setError('Ошибка создания чата');
      console.error('Error creating chat:', err);
    }
  };

  const sendMessage = async () => {
    if (!token || !chat || !newMessage.trim()) return;
    
    const messageContent = newMessage.trim();
    // Don't clear input immediately to prevent flickering
    
    // Add message locally for immediate feedback with optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      chatId: chat.id,
      content: messageContent,
      senderType: 'USER' as const,
      senderId: null,
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isRead: false
    };
    
    setChat(prevChat => {
      if (!prevChat) return prevChat;
      return {
        ...prevChat,
        messages: [...(prevChat.messages || []), tempMessage]
      };
    });
    
    setTimeout(scrollToBottom, 100);
    
    try {
      const response = await supportApi.sendSupportMessage(
        chat.id, 
        messageContent,
        [],
        token
      );
      
      if (response.success) {
        // Clear input only after successful send
        setNewMessage('');
        
        // Update temp message with real message data
        setChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            messages: prevChat.messages?.map(m => 
              m.id === tempMessage.id ? { ...m, id: response.data.id, createdAt: response.data.createdAt, updatedAt: response.data.updatedAt } : m
            ) || []
          };
        });
      } else {
        // Remove temp message on error
        setChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            messages: prevChat.messages?.filter(m => m.id !== tempMessage.id) || []
          };
        });
        // Don't restore message content to prevent flickering
        setError(response.error || 'Ошибка отправки сообщения');
      }
    } catch (err) {
      // Remove temp message on error
      setChat(prevChat => {
        if (!prevChat) return prevChat;
        return {
          ...prevChat,
          messages: prevChat.messages?.filter(m => m.id !== tempMessage.id) || []
        };
      });
      // Don't restore message content to prevent flickering
      setError('Ошибка отправки сообщения');
      console.error('Error sending message:', err);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  if (loading) {
    return (
      <div className="support-page">
        <div className="loading">Загрузка чата поддержки...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="support-page">
        <div className="error">
          <h3>Ошибка</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="support-page">
      <div className="support-header">
        <div className="header-content">
          <button 
            onClick={() => window.history.back()}
            title="Назад"
            style={{
              background: 'red',
              color: 'white',
              border: '2px solid yellow',
              padding: '10px',
              fontSize: '16px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            ← НАЗАД
          </button>
          <div>
            <h2>Поддержка</h2>
            <p>Мы всегда готовы помочь <span className="online-indicator">🟢</span></p>
          </div>
          {chat && (
            <button 
              className="refresh-btn" 
              onClick={loadChat}
              title="Обновить сообщения"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      <div className="support-content">
        {!chat ? (
          <div className="no-chat">
            <div className="no-chat-content">
              <h3>💬 Начать общение</h3>
              <p>У вас пока нет активного чата с поддержкой. Нажмите кнопку ниже, чтобы начать общение.</p>
              <button onClick={createChat} className="create-chat-btn">
                Начать чат
              </button>
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {chat.messages?.length === 0 ? (
              <div className="no-messages">
                <p>💬 Пока нет сообщений. Напишите что-нибудь!</p>
              </div>
            ) : (
              <div className="messages">
                {chat.messages?.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.senderType === 'ADMIN' ? 'admin-message' : 'user-message'}`}
                  >
                    <div className="message-content">
                      {message.content}
                    </div>
                    <div className="message-time">
                      {formatTime(message.createdAt)}
                      {message.senderType === 'USER' && (
                        <span className={`message-status ${message.isRead ? 'read' : 'sent'}`}>
                          {message.isRead ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        )}

        {chat?.isAdminTyping && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">Поддержка печатает...</span>
          </div>
        )}
      </div>

      {/* Fixed input at bottom */}
      {chat && (
        <div className="message-input-fixed">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Введите ваше сообщение..."
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage} disabled={!newMessage.trim()}>
            Отправить
          </button>
        </div>
      )}
    </div>
  );
};

export default SupportPage;