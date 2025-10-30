import React, { useState, useEffect, useRef } from 'react';
import { supportApi, SupportChat, SupportMessage, getAuthToken, authApi, setAuthToken } from '../api';
import { io, Socket } from 'socket.io-client';
import { getTelegramWebApp, getTelegramInitData } from '../telegram';
import './SupportPage.css';

const SupportPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [chat, setChat] = useState<SupportChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachmentsPreview, setAttachmentsPreview] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatIdRef = useRef<number | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const attemptTelegramAutoLogin = async (): Promise<boolean> => {
    try {
      console.log('🔍 Attempting Telegram auto-login...');
      setDebugInfo('🔍 Проверяем Telegram WebApp...');
      
      console.log('🔍 window.Telegram:', !!window.Telegram);
      console.log('🔍 window.Telegram.WebApp:', !!window.Telegram?.WebApp);
      console.log('🔍 window.Telegram.WebApp.initData:', window.Telegram?.WebApp?.initData);
      console.log('🔍 window.Telegram.WebApp.initDataUnsafe:', window.Telegram?.WebApp?.initDataUnsafe);
      
      const initData = getTelegramInitData();
      console.log('🔍 initData:', initData ? 'present' : 'missing');
      console.log('🔍 initData value:', initData);
      
      if (!initData) {
        console.log('⚠️ No Telegram initData available, trying dev mode...');
        setDebugInfo('⚠️ initData отсутствует, пробуем dev-режим...');
        
        // Попробуем dev-режим авторизацию
        try {
          setDebugInfo('🔍 Отправляем запрос к API...');
          const response = await authApi.devLogin('123456789');
          console.log('🔍 Dev login response:', response);
          setDebugInfo(`🔍 Ответ API: ${response.success ? 'успех' : 'ошибка'}`);
          
          if (response.success && response.data) {
            console.log('✅ Dev login successful');
            setDebugInfo('✅ Авторизация успешна!');
            setAuthToken(response.data.token);
            setToken(response.data.token);
            setUser(response.data.user);
            return true;
          } else {
            console.log('❌ Dev login failed:', response.error);
            setDebugInfo(`❌ Ошибка авторизации: ${response.error}`);
          }
        } catch (devError) {
          console.log('❌ Dev login error:', devError);
          setDebugInfo(`❌ Ошибка запроса: ${devError}`);
        }
        return false;
      }
      
      console.log('🔍 Attempting auto-login with initData');
      setDebugInfo('🔍 Пробуем авторизацию через Telegram...');
      const response = await authApi.telegramLogin(initData);
      console.log('🔍 Telegram login response:', response);
      setDebugInfo(`🔍 Ответ Telegram API: ${response.success ? 'успех' : 'ошибка'}`);
      
      if (response.success && response.data) {
        console.log('✅ Auto-login successful');
        setDebugInfo('✅ Авторизация через Telegram успешна!');
        setAuthToken(response.data.token);
        setToken(response.data.token);
        setUser(response.data.user);
        return true;
      } else {
        console.log('❌ Auto-login failed:', response.error);
        setDebugInfo(`❌ Ошибка Telegram авторизации: ${response.error}`);
      }
    } catch (error) {
      console.log('❌ Auto-login error:', error);
      setDebugInfo(`❌ Общая ошибка: ${error}`);
    }
    return false;
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

    const RAW_API = (import.meta as any).env?.VITE_API_URL || (window as any).VITE_API_URL || 'https://api.beripritsep.ru';
    let WS_URL = 'https://api.beripritsep.ru';
    try {
      WS_URL = new URL(RAW_API).origin; // надёжно берём origin
    } catch {
      // fallback: если RAW_API кривой типа 'https'
      WS_URL = 'https://api.beripritsep.ru';
    }

    socketRef.current = io(WS_URL, {
      auth: { token: token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      withCredentials: true
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setIsSocketConnected(true);
      // Повторно присоединяем комнату при (ре)подключении
      if (chatIdRef.current != null) {
        socketRef.current!.emit('join-support-chat', chatIdRef.current);
      }
    });

    socketRef.current.on('new-message', (message: SupportMessage) => {
      console.log('📨 New message received:', message);
      // Добавляем сразу, без дебаунса
      
      setChat(prevChat => {
        if (!prevChat) return prevChat;
        const messages = prevChat.messages || [];
        // Если пришёл эхо-набор USER из сервера, заменяем temp по контенту
        if (message.senderType === 'USER') {
          const idx = messages.findIndex(m => m.id.toString().startsWith('temp-') && m.content === message.content);
          if (idx !== -1) {
            const updated = [...messages];
            updated[idx] = message;
            return { ...prevChat, messages: updated };
          }
        }
        // Если уже есть по id — не добавляем
        const existsById = messages.some(m => String(m.id) === String(message.id));
        if (existsById) return prevChat;
        
        // Play notification sound for incoming messages (not from current user)
        if (message.senderType === 'ADMIN') {
          playNotificationSound();
        }
        return { ...prevChat, messages: [...messages, message] };
      });
      // Auto-scroll только если пользователь не печатает
      if (!isTyping && !newMessage.trim()) {
        setTimeout(scrollToBottom, 100);
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setIsSocketConnected(false);
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

    const initializeAuth = async () => {
      console.log('🔍 Initializing auth...');
      console.log('🔍 Current token:', token ? 'present' : 'missing');
      
      if (token) {
        try {
          // Ensure user is loaded when token exists
          const profile = await authApi.getProfile(token);
          if (profile.success && profile.data) {
            setUser(profile.data);
          } else {
            // token might be invalid; try Telegram auto-login
            const ok = await attemptTelegramAutoLogin();
            if (!ok) throw new Error('Profile load failed');
          }
        } catch (e) {
          console.warn('Profile load failed, trying auto-login');
        }
        console.log('✅ Token available, connecting WebSocket and loading chat');
        connectWebSocket();
        loadChat();
      } else {
        console.log('⚠️ No token, attempting Telegram auto-login');
        // Попробуем автоматическую авторизацию через Telegram
        const authSuccess = await attemptTelegramAutoLogin();
        if (authSuccess) {
          console.log('✅ Auth successful, connecting WebSocket and loading chat');
          connectWebSocket();
          loadChat();
        } else {
          console.log('❌ Auth failed, showing error');
          setError('Необходимо авторизоваться');
          setLoading(false);
        }
      }
    };

    initializeAuth();


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
            // Don't hide navigation in support page
          } else {
            // Keyboard is hidden
            setIsInputFocused(false);
            // Don't hide navigation in support page
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

    // Fallback polling до установления сокета
    const polling = setInterval(async () => {
      if (!isSocketConnected && token && chatIdRef.current != null) {
        try {
          const resp = await supportApi.getSupportChat(chatIdRef.current, token);
          if (resp.success && resp.data) {
            setChat(prev => {
              if (!prev) return resp.data;
              // если появились новые сообщения — обновляем
              const prevLast = prev.messages?.[prev.messages.length - 1]?.id;
              const newLast = resp.data.messages?.[resp.data.messages.length - 1]?.id;
              if (String(prevLast) !== String(newLast)) {
                return resp.data;
              }
              return prev;
            });
          }
        } catch {}
      }
    }, 3000);

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      disconnectWebSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      // Clean up
      cleanupIOS();
      clearInterval(polling);
    };
  }, [token]);

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages]);

  // Force navigation to be visible in support page
  useEffect(() => {
    const forceNavbarVisible = () => {
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        navbar.style.display = 'flex';
        navbar.style.visibility = 'visible';
        navbar.style.opacity = '1';
        navbar.style.position = 'fixed';
        navbar.style.bottom = '0';
        navbar.style.left = '0';
        navbar.style.right = '0';
        navbar.style.zIndex = '9999999';
      }
      
      // Also remove hide-navigation class from body
      document.body.classList.remove('hide-navigation');
    };

    // Force immediately
    forceNavbarVisible();

    // Force every 100ms to override any other code
    const interval = setInterval(forceNavbarVisible, 100);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Убираем автообновление - оно мешает пользователю
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     if (token && chat) {
  //       loadChat();
  //     }
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, [token, chat]);

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
    const accepted: File[] = [];
    const previews: string[] = [];
    for (const file of Array.from(files)) {
      // Пытаемся сжать картинки, остальные файлы пропускаем если большие
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        try {
          const dataUrl = await compressImageToDataUrl(file);
          // проверим итоговый размер
          const size = Math.ceil((dataUrl.length * 3) / 4);
          if (size <= maxSize) {
            accepted.push(file);
            previews.push(dataUrl);
          }
        } catch {}
      } else {
        if (file.size <= maxSize) {
          // для небинарных/неизображений оставим как blob URL
          const dataUrl = URL.createObjectURL(file);
          accepted.push(file);
          previews.push(dataUrl);
        }
      }
    }
    setPendingFiles(prev => [...prev, ...accepted]);
    setAttachmentsPreview(prev => [...prev, ...previews]);
  };

  const clearPendingAttachments = () => {
    setPendingFiles([]);
    setAttachmentsPreview([]);
  };

  const loadChat = async () => {
    if (!token) {
      console.log('❌ No token available for loading chat');
      return;
    }
    
    try {
      console.log('🔍 Loading support chat...');
      setLoading(true);
      const response = await supportApi.getSupportChats(token);
      
      console.log('🔍 Support chat response:', response);
      
      if (response.success) {
        if (response.data) {
          console.log('✅ Chat loaded successfully');
          setChat(response.data);
          joinChatRoom(response.data.id);
          chatIdRef.current = response.data.id;
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('join-support-chat', response.data.id);
          }
        } else {
          // Нет чата — это не ошибка, предложим создать
          console.log('ℹ️ No support chat yet');
          setChat(null);
          setError(null);
        }
      } else {
        console.log('❌ Chat loading failed:', response.error);
        setError(response.error || 'Ошибка загрузки чата');
      }
    } catch (err) {
      console.log('❌ Chat loading error:', err);
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
        chatIdRef.current = response.data.id;
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('join-support-chat', response.data.id);
        }
      } else {
        setError(response.error || 'Ошибка создания чата');
      }
    } catch (err) {
      setError('Ошибка создания чата');
      console.error('Error creating chat:', err);
    }
  };

  const sendMessage = async () => {
    if (!token || !chat || (!newMessage.trim() && pendingFiles.length === 0)) return;
    
    const messageContent = newMessage.trim();
    // Prepare attachments as data URLs (already in previews)
    const attachmentsToSend = [...attachmentsPreview];
    const finalContent = messageContent || (attachmentsToSend.length > 0 ? 'Вложение' : '');
    // Don't clear input immediately to prevent flickering
    
    // Add message locally for immediate feedback with optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      chatId: chat.id,
      content: finalContent,
      senderType: 'USER' as const,
      senderId: null,
      attachments: attachmentsToSend,
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
        finalContent,
        attachmentsToSend,
        token
      );
      
      if (response.success) {
        // Clear input/attachments только после успешной отправки и вернуть фокус
        setNewMessage('');
        clearPendingAttachments();
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
        
        // Update temp message with real message data
        setChat(prevChat => {
          if (!prevChat) return prevChat;
          return {
            ...prevChat,
            messages: prevChat.messages?.map(m => 
              String(m.id) === String(tempMessage.id) ? { ...m, id: response.data.id, createdAt: response.data.createdAt, updatedAt: response.data.updatedAt } : m
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
          messages: prevChat.messages?.filter(m => String(m.id) !== String(tempMessage.id)) || []
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
        <div className="loading">
          <div>Загрузка чата поддержки...</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            🔍 Отладка: Проверяем авторизацию...
          </div>
          {debugInfo && (
            <div style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>
              {debugInfo}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="support-page">
        <div className="error">
          <h3>Ошибка</h3>
          <p>{error}</p>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '10px', textAlign: 'left' }}>
            <div>🔍 Отладочная информация:</div>
            <div>• Telegram WebApp: {window.Telegram ? '✅ Доступен' : '❌ Недоступен'}</div>
            <div>• initData: {getTelegramInitData() ? '✅ Есть' : '❌ Нет'}</div>
            <div>• Токен: {token ? '✅ Есть' : '❌ Нет'}</div>
            <div>• Пользователь: {user ? `✅ Загружен (${user.firstName})` : '❌ Не загружен'}</div>
          </div>
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
          <div className="header-left">
            <h2>Поддержка</h2>
            <p>Мы всегда готовы помочь <span className="online-indicator">🟢</span></p>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
              🔍 Debug: {window.Telegram ? 'TG✅' : 'TG❌'} | {token ? 'Token✅' : 'Token❌'} | {user ? `User✅(${user.firstName})` : 'User❌'}
            </div>
          </div>
          <div className="header-right">
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
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="attachments" style={{ marginTop: '8px' }}>
                          {message.attachments.map((att, idx) => {
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
                      )}
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
          <button onClick={sendMessage} disabled={!newMessage.trim() && attachmentsPreview.length === 0}>
            Отправить
          </button>
        </div>
      )}
    </div>
  );
};

export default SupportPage;