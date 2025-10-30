import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { supportApi, SupportChat } from '../api';
import { io, Socket } from 'socket.io-client';
import './SupportPage.css';

const SupportPage: React.FC = () => {
  const { token } = useAdminAuth();
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(() => {
    // Try to restore selected chat from localStorage
    const savedChatId = localStorage.getItem('admin-selected-chat-id');
    return savedChatId ? { id: parseInt(savedChatId) } as SupportChat : null;
  });
  const [newMessage, setNewMessage] = useState('');
  const [attachmentsPreview, setAttachmentsPreview] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const typingTimeoutRef = useRef<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const forceScrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
      
      // Force scroll with multiple methods
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
      
      // Also try immediate scroll
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 10);
    }
  };

  useEffect(() => {
    if (token) {
      connectWebSocket();
      loadChats();
      
      // Load saved chat if exists
      if (selectedChat?.id) {
        loadSelectedChat(selectedChat.id, true);
      }
    }

    // WebSocket provides real-time updates, no need for polling
    return () => {
      disconnectWebSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [token]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (selectedChat?.messages && messagesContainerRef.current) {
      // Use multiple timeouts to ensure scroll happens
      setTimeout(forceScrollToBottom, 10);
      setTimeout(forceScrollToBottom, 50);
      setTimeout(forceScrollToBottom, 100);
      setTimeout(forceScrollToBottom, 200);
      setTimeout(forceScrollToBottom, 300);
      setTimeout(forceScrollToBottom, 500);
      setTimeout(forceScrollToBottom, 800);
    }
  }, [selectedChat?.messages]);

  const connectWebSocket = () => {
    if (!token) return;
    
    // Disconnect existing connection if any
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080/api';
    const WS_URL = API_BASE_URL.replace('/api', '');

    socketRef.current = io(WS_URL, {
      auth: {
        token: token
      }
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Admin WebSocket connected');
    });

    socketRef.current.on('new-message', (message: any) => {
      console.log('📨 New message received in admin:', message);
      
      // Don't update if user is actively typing
      if (isTyping) {
        console.log('🚫 Blocking update - user is typing');
        return;
      }
      // Для ADMIN-сообщения пробуем заменить временное по контенту
      
      const now = Date.now();
      const timeSinceLastUpdate = now - lastMessageTimeRef.current;
      
      // Debounce updates - only update if more than 500ms passed since last update
      if (timeSinceLastUpdate < 500) {
        return;
      }
      
      lastMessageTimeRef.current = now;
      
      // Update selected chat if it's the same chat
      if (selectedChat && Number(selectedChat.id) === Number(message.chatId)) {
        setSelectedChat(prevChat => {
          if (!prevChat) return prevChat;
          const messages = prevChat.messages || [];
          // 1) Заменяем temp-сообщение, если совпадает контент (эхо админского)
          if (message.senderType === 'ADMIN') {
            const idx = messages.findIndex(m => m.id.toString().startsWith('temp-') && m.content === message.content);
            if (idx !== -1) {
              const updated = [...messages];
              updated[idx] = message;
              return { ...prevChat, messages: updated };
            }
          }
          // 2) Если уже есть такое id — не добавляем
          const existsById = messages.some(m => String(m.id) === String(message.id));
          if (existsById) return prevChat;
          // 3) В остальных случаях — добавляем
          return { ...prevChat, messages: [...messages, message] };
        });
        
        // Auto-scroll to bottom after new message
        setTimeout(forceScrollToBottom, 50);
        setTimeout(forceScrollToBottom, 200);
      }
      
      // Update chats list to show new message indicator
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === message.chatId 
            ? { ...chat, lastMessageAt: message.createdAt }
            : chat
        )
      );
    });

    // Handle typing indicators
    socketRef.current.on('typing-start', (data: any) => {
      console.log('⌨️ User started typing:', data);
      if (selectedChat && selectedChat.id === data.chatId) {
        setSelectedChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            isUserTyping: true
          };
        });
      }
    });

    socketRef.current.on('typing-stop', (data: any) => {
      console.log('⌨️ User stopped typing:', data);
      if (selectedChat && selectedChat.id === data.chatId) {
        setSelectedChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            isUserTyping: false
          };
        });
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('🔌 Admin WebSocket disconnected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Admin WebSocket connection error:', error);
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

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set typing indicator immediately when user starts typing
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      console.log('⌨️ Admin started typing');
      
      // Send typing start event
      if (socketRef.current && selectedChat) {
        socketRef.current.emit('typing-start', { chatId: selectedChat.id });
      }
    }
    
    // Clear typing indicator after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      console.log('⌨️ Admin stopped typing');
      
      // Send typing stop event
      if (socketRef.current && selectedChat) {
        socketRef.current.emit('typing-stop', { chatId: selectedChat.id });
      }
    }, 2000);
  };

  const compressImageToDataUrl = (file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(maxWidth / width, maxHeight / height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('no ctx'));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('img error'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('read error'));
      reader.readAsDataURL(file);
    });
  };

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const maxSize = 600 * 1024; // ~600KB на вложение, чтобы не упираться в 413
    const previews: string[] = [];
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        try {
          const dataUrl = await compressImageToDataUrl(file);
          const size = Math.ceil((dataUrl.length * 3) / 4);
          if (size <= maxSize) previews.push(dataUrl);
        } catch {}
      } else {
        if (file.size <= maxSize) {
          const url = URL.createObjectURL(file);
          previews.push(url);
        }
      }
    }
    setAttachmentsPreview(prev => [...prev, ...previews]);
  };

  const clearPendingAttachments = () => {
    setAttachmentsPreview([]);
  };

  const renderAttachments = (attachments?: string[]) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <div className="attachments" style={{ marginTop: '8px' }}>
        {attachments.map((att, idx) => {
          const isImage = /^data:image\//.test(att) || /\.(png|jpe?g|gif|webp)$/i.test(att);
          return (
            <div key={idx} style={{ marginTop: '6px' }}>
              {isImage ? (
                <img src={att} alt="attachment" style={{ maxWidth: '220px', borderRadius: '8px' }} />
              ) : (
                <a href={att} target="_blank" rel="noreferrer">Файл</a>
              )}
            </div>
          );
        })}
      </div>
    );
  };


  const loadChats = async (silent = false) => {
    if (!token) return;
    
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await supportApi.getSupportChats(token);
      
      if (response.success && response.data) {
        setChats(response.data);
        if (!silent) {
          setError(null);
        }
      } else {
        if (!silent) {
          setError(response.error || 'Failed to load chats');
        }
      }
    } catch (err) {
      if (!silent) {
        setError('Failed to load chats');
        console.error('Error loading chats:', err);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const sendMessage = async () => {
    if (!token || !selectedChat || (!newMessage.trim() && attachmentsPreview.length === 0)) return;
    
    const messageContent = newMessage.trim();
    const finalContent = messageContent || (attachmentsPreview.length > 0 ? 'Вложение' : '');
    setNewMessage(''); // Clear input immediately
    
    // Add message locally for immediate feedback
    const tempMessage: any = {
      id: `temp-${Date.now()}` as any,
      chatId: selectedChat.id,
      content: finalContent,
      senderType: 'ADMIN' as const,
      senderId: undefined,
      attachments: attachmentsPreview,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setSelectedChat(prevChat => {
      if (!prevChat) return prevChat;
      return {
        ...prevChat,
        messages: [...(prevChat.messages || []), tempMessage]
      };
    });
    
    // Auto-scroll to bottom after adding temp message
    setTimeout(forceScrollToBottom, 50);
    setTimeout(forceScrollToBottom, 100);
    setTimeout(forceScrollToBottom, 200);
    
    try {
      console.log('Sending message:', messageContent);
      const response = await supportApi.sendSupportMessage(
        token,
        selectedChat.id,
        finalContent,
        attachmentsPreview
      );
      console.log('Send message response:', response);
      
      if (response.success && response.data) {
        console.log('Message sent successfully:', response.data);
        
        // Update temp message with real message data
        setSelectedChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            messages: (() => {
              const updated = prevChat.messages?.map(m => 
                String(m.id) === String(tempMessage.id) 
                  ? { ...m, id: response.data!.id as any, createdAt: response.data!.createdAt } 
                  : m
              ) || [];
              // Удалим возможные дубли с тем же id
              const seen = new Set<string>();
              const dedup = updated.filter((m: any) => {
                const key = String(m.id);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              // Удалим все временные сообщения с тем же контентом
              return dedup.filter((m: any) => !(m.id.toString().startsWith('temp-') && m.content === response.data!.content));
            })()
          };
        });
        
        clearPendingAttachments();
        // Force scroll to bottom after successful send - multiple attempts
        setTimeout(forceScrollToBottom, 50);
        setTimeout(forceScrollToBottom, 100);
        setTimeout(forceScrollToBottom, 150);
        setTimeout(forceScrollToBottom, 200);
        setTimeout(forceScrollToBottom, 300);
        setTimeout(forceScrollToBottom, 500);
        setTimeout(forceScrollToBottom, 800);
        setTimeout(forceScrollToBottom, 1000);
      } else if (response.success && !response.data) {
        console.log('Message sent but no data returned, keeping temp message');
        // Keep the temp message if no data is returned
      } else {
        // Remove temp message on error
        setSelectedChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            messages: prevChat.messages?.filter(m => m.id !== tempMessage.id) || []
          };
        });
        setNewMessage(messageContent); // Restore message content
        setError(response.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Remove temp message on error
      setSelectedChat(prevChat => {
        if (!prevChat) return prevChat;
        return {
          ...prevChat,
          messages: prevChat.messages?.filter(m => m.id !== tempMessage.id) || []
        };
      });
      setNewMessage(messageContent); // Restore message content
      setError('Failed to send message');
    }
  };

  const loadSelectedChat = async (chatId: number, silent = false) => {
    if (!token) return;
    
    try {
      const response = await supportApi.getSupportChat(token, chatId);
      if (response.success && response.data) {
        setSelectedChat(response.data);
        // Save selected chat to localStorage
        localStorage.setItem('admin-selected-chat-id', chatId.toString());
        // Join WebSocket room for this chat
        joinChatRoom(chatId);
        
        // Auto-scroll to bottom after loading chat
        setTimeout(forceScrollToBottom, 100);
        setTimeout(forceScrollToBottom, 300);
        setTimeout(forceScrollToBottom, 600);
      }
    } catch (err) {
      if (!silent) {
        console.error('Error loading chat:', err);
      }
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  if (loading) {
    return (
      <div className="support-page">
        <div className="loading">Загрузка чатов...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="support-page">
        <div className="error">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="support-page">
      <div className="support-header">
        <div className="header-content">
          <div>
            <h2>Чат поддержки</h2>
            <p>Общение с пользователями</p>
          </div>
          <button 
            className="refresh-btn" 
            onClick={() => {
              loadChats();
              if (selectedChat) {
                loadSelectedChat(selectedChat.id);
              }
            }}
            title="Обновить чаты"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="support-content">
        <div className="chats-list">
          <h3>Чаты пользователей</h3>
          {chats.length === 0 ? (
            <div className="no-chats">Нет активных чатов</div>
          ) : (
            <div className="chats">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
                  onClick={() => loadSelectedChat(chat.id)}
                >
                  <div className="chat-info">
                    <div className="user-name">
                      {chat.user?.firstName} {chat.user?.lastName}
                    </div>
                    <div className="last-message-time">
                      {formatTime(chat.lastMessageAt)}
                    </div>
                  </div>
                  <div className="unread-count">
                    {chat.messages?.filter(m => m.senderType === 'USER' && !m.isRead).length || 0}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chat-area">
          {selectedChat ? (
            <>
              <div className="chat-header">
                <div className="chat-user-info">
                  <h3>{selectedChat.user?.firstName} {selectedChat.user?.lastName}</h3>
                  <p>@{selectedChat.user?.username}</p>
                </div>
              </div>

              <div className="messages-container" ref={messagesContainerRef}>
                {selectedChat.messages?.length === 0 ? (
                  <div className="no-messages">Нет сообщений</div>
                ) : (
                  <div className="messages">
                    {selectedChat.messages?.map((message) => (
                      <div
                        key={message.id}
                        className={`message ${message.senderType === 'ADMIN' ? 'admin-message' : 'user-message'}`}
                      >
                        <div className="message-content">
                          {message.content}
                          {renderAttachments((message as any).attachments)}
                        </div>
                        <div className="message-time">
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Typing indicator */}
                {selectedChat?.isUserTyping && (
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-text">Печатает...</span>
                  </div>
                )}
              </div>

              <div className="message-input">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onFocus={() => {
                    // Scroll to bottom when input is focused
                    setTimeout(forceScrollToBottom, 100);
                    setTimeout(forceScrollToBottom, 300);
                  }}
                  placeholder="Введите сообщение..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      sendMessage();
                      // Force scroll after pressing Enter
                      setTimeout(forceScrollToBottom, 50);
                      setTimeout(forceScrollToBottom, 200);
                      setTimeout(forceScrollToBottom, 500);
                    }
                  }}
                />
                {attachmentsPreview.length > 0 && (
                  <div style={{ position: 'absolute', bottom: '52px', left: '10px', right: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {attachmentsPreview.map((p, i) => (
                      <div key={i} style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0', background: '#fafafa' }}>
                        {/^data:image\//.test(p) ? (
                          <img src={p} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ fontSize: 10, padding: 6 }}>файл</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <label className="attach-btn" title="Прикрепить файл" style={{ marginLeft: '6px', cursor: 'pointer' }}>
                  📎
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    multiple
                    onChange={(e) => onFilesSelected(e.target.files)}
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  />
                </label>
                <button 
                  onClick={() => {
                    sendMessage();
                    // Force scroll after clicking send
                    setTimeout(forceScrollToBottom, 50);
                    setTimeout(forceScrollToBottom, 200);
                    setTimeout(forceScrollToBottom, 500);
                  }} 
                  disabled={!newMessage.trim() && attachmentsPreview.length === 0}
                >
                  Отправить
                </button>
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <p>Выберите чат для начала общения</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportPage;