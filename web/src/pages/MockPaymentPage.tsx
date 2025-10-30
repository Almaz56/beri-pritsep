import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const MockPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId') || '';

  const handleSuccess = () => {
    navigate(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`);
  };

  const handleFail = () => {
    navigate(`/payment/failed?paymentId=${encodeURIComponent(paymentId)}`);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Тестовая оплата (mock)</h1>
      <p style={{ marginTop: 0, color: '#666' }}>ID платежа: {paymentId}</p>

      <div style={{
        marginTop: 16,
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        padding: 16,
        background: '#fafafa'
      }}>
        <p>Это демонстрационная страница оплаты. Выберите исход:</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={handleSuccess} style={{
            background: '#4CAF50', color: '#fff', padding: '10px 16px', borderRadius: 6, border: 'none', cursor: 'pointer'
          }}>Оплатить</button>
          <button onClick={handleFail} style={{
            background: '#e53935', color: '#fff', padding: '10px 16px', borderRadius: 6, border: 'none', cursor: 'pointer'
          }}>Отмена</button>
        </div>
      </div>
    </div>
  );
};

export default MockPaymentPage;


