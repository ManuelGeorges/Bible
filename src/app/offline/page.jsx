"use client";

import Link from 'next/link';
import strings from '../data/ar.json';

export default function OfflinePage() {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '100px 20px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '70vh',
      direction: 'rtl'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>{strings.offline.title}</h1>
      <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '30px' }}>
        {strings.offline.desc}
      </p>
      
      <Link 
        href="/" 
        style={{ 
          padding: '12px 25px', 
          fontSize: '1rem', 
          backgroundColor: '#0070f3', 
          color: 'white', 
          textDecoration: 'none',
          borderRadius: '5px', 
          cursor: 'pointer',
          transition: 'background-color 0.3s ease'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0070f3'}
      >
        {strings.common.view_all} {/* Or a specific "Back Home" string */}
      </Link>
    </div>
  );
}
