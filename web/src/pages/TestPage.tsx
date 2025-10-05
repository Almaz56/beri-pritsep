import React, { useState } from 'react';
import './TestPage.css';

const TestPage: React.FC = () => {
  const [testData, setTestData] = useState({
    date: '',
    time: '',
    duration: 2,
    type: 'HOURLY' as 'HOURLY' | 'DAILY'
  });

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setTestData(prev => ({ ...prev, date: e.target.value }));
      console.log('Date changed:', e.target.value);
    } catch (error) {
      console.error('Error setting date:', error);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setTestData(prev => ({ ...prev, time: e.target.value }));
      console.log('Time changed:', e.target.value);
    } catch (error) {
      console.error('Error setting time:', error);
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const value = parseInt(e.target.value) || 2;
      setTestData(prev => ({ ...prev, duration: value }));
      console.log('Duration changed:', value);
    } catch (error) {
      console.error('Error setting duration:', error);
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      setTestData(prev => ({ ...prev, type: e.target.value as 'HOURLY' | 'DAILY' }));
      console.log('Type changed:', e.target.value);
    } catch (error) {
      console.error('Error setting type:', error);
    }
  };

  return (
    <div className="test-page">
      <h1>Тестовая страница</h1>
      <p>Эта страница для тестирования форм без вылетов</p>
      
      <div className="test-form">
        <div className="form-group">
          <label>Дата:</label>
          <input
            type="date"
            value={testData.date}
            onChange={handleDateChange}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="form-group">
          <label>Время:</label>
          <input
            type="time"
            value={testData.time}
            onChange={handleTimeChange}
          />
        </div>

        <div className="form-group">
          <label>Продолжительность:</label>
          <input
            type="number"
            min={1}
            value={testData.duration}
            onChange={handleDurationChange}
          />
        </div>

        <div className="form-group">
          <label>Тип:</label>
          <select value={testData.type} onChange={handleTypeChange}>
            <option value="HOURLY">Почасовая</option>
            <option value="DAILY">Посуточная</option>
          </select>
        </div>

        <div className="form-data">
          <h3>Текущие данные:</h3>
          <pre>{JSON.stringify(testData, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

export default TestPage;
