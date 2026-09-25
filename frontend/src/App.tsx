import React from 'react';

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Employee Management &amp; Internal Help Desk System</h1>
      <p style={{ color: '#666' }}>
        Frontend initialized and ready for development. Connected to Spring Boot backend on port 8080.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem' }}>
          <h3>Identity &amp; RBAC</h3>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Users, roles, departments, and reporting hierarchy.</p>
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem' }}>
          <h3>Leave Domain</h3>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Leave requests, balance tracking, and approval workflows.</p>
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem' }}>
          <h3>Help Desk Domain</h3>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Incident tickets, triage queues, and SLA monitoring.</p>
        </div>
      </div>
    </div>
  );
}
