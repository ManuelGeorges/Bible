'use client';
import { useState } from 'react';
import SwipeNavigation from './SwipeNavigation';
import BibleNavbar from './BibleNavbar';
import MoreSidebar from '../app/more/MoreSidebar'; 

export default function ClientLayoutWrapper({ children, styles }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      <MoreSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        isPage={false} 
      />
      <BibleNavbar onMoreClick={() => setIsSidebarOpen(true)} />
      <SwipeNavigation onOpenMenu={() => setIsSidebarOpen(true)}>
        <main className={styles.mainContent}>
          <div className={styles.container}>{children}</div>
        </main>
      </SwipeNavigation>
    </>
  );
}