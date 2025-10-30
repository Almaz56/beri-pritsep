import React, { useState, useEffect } from 'react';
import { showTelegramAlert } from '../telegram';

interface RentalCountdownProps {
  startTime: Date;
  endTime: Date;
  onTimeUp?: () => void;
  onExtendRental?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const RentalCountdown: React.FC<RentalCountdownProps> = ({
  startTime,
  endTime,
  onTimeUp,
  onExtendRental
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0
  });
  const [isExpired, setIsExpired] = useState(false);
  const [showExtendButton, setShowExtendButton] = useState(false);

  const calculateTimeLeft = (): TimeLeft => {
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    const difference = end - now;

    if (difference <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        total: 0
      };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return {
      days,
      hours,
      minutes,
      seconds,
      total: difference
    };
  };

  useEffect(() => {
    const updateTimer = () => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.total <= 0 && !isExpired) {
        setIsExpired(true);
        showTelegramAlert('⏰ Время аренды истекло! Пожалуйста, верните прицеп.');
        onTimeUp?.();
      }

      // Show extend button when less than 1 hour left
      if (newTimeLeft.total <= 3600000 && newTimeLeft.total > 0) {
        setShowExtendButton(true);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [endTime, isExpired, onTimeUp]);

  const formatTime = (value: number): string => {
    return value.toString().padStart(2, '0');
  };

  const getStatusColor = (): string => {
    if (isExpired) return '#ff4757';
    if (timeLeft.total <= 3600000) return '#ffa502'; // Less than 1 hour
    if (timeLeft.total <= 7200000) return '#ff9f43'; // Less than 2 hours
    return '#2ed573';
  };

  const getStatusText = (): string => {
    if (isExpired) return 'Время истекло';
    if (timeLeft.total <= 3600000) return 'Заканчивается';
    if (timeLeft.total <= 7200000) return 'Скоро закончится';
    return 'Активна';
  };

  const handleExtendRental = () => {
    if (onExtendRental) {
      onExtendRental();
    } else {
      showTelegramAlert('Функция продления аренды будет доступна в ближайшее время');
    }
  };

  if (isExpired) {
    return (
      <div className="rental-countdown expired">
        <div className="countdown-header">
          <h3>⏰ Аренда завершена</h3>
          <p>Время аренды истекло. Пожалуйста, верните прицеп.</p>
        </div>
        <div className="countdown-actions">
          <button 
            className="btn-primary extend-btn"
            onClick={handleExtendRental}
          >
            Продлить аренду
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rental-countdown">
      <div className="countdown-header">
        <h3>⏱️ Осталось времени</h3>
        <div className="countdown-status" style={{ color: getStatusColor() }}>
          {getStatusText()}
        </div>
      </div>
      
      <div className="countdown-timer">
        <div className="time-unit">
          <div className="time-value" style={{ color: getStatusColor() }}>
            {formatTime(timeLeft.days)}
          </div>
          <div className="time-label">дней</div>
        </div>
        <div className="time-separator">:</div>
        <div className="time-unit">
          <div className="time-value" style={{ color: getStatusColor() }}>
            {formatTime(timeLeft.hours)}
          </div>
          <div className="time-label">часов</div>
        </div>
        <div className="time-separator">:</div>
        <div className="time-unit">
          <div className="time-value" style={{ color: getStatusColor() }}>
            {formatTime(timeLeft.minutes)}
          </div>
          <div className="time-label">мин</div>
        </div>
        <div className="time-separator">:</div>
        <div className="time-unit">
          <div className="time-value" style={{ color: getStatusColor() }}>
            {formatTime(timeLeft.seconds)}
          </div>
          <div className="time-label">сек</div>
        </div>
      </div>

      {showExtendButton && (
        <div className="countdown-actions">
          <button 
            className="btn-primary extend-btn"
            onClick={handleExtendRental}
          >
            Продлить аренду
          </button>
        </div>
      )}

      <div className="countdown-info">
        <div className="rental-period">
          <div className="period-item">
            <span className="period-label">Начало:</span>
            <span className="period-value">
              {startTime.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <div className="period-item">
            <span className="period-label">Окончание:</span>
            <span className="period-value">
              {endTime.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RentalCountdown;
