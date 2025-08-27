"use client";
import Link from "next/link";
import styles from './layout.module.css'; 

export default function BibleNavbar() {
  return (
    <div className={styles.navbarWrapper}>
      <nav className={`${styles.navbar} ${styles.navbarTop}`}>
        <Link href="/studyPlans" className={styles.navLink} aria-label="Study Plans">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d="M19 12H17V10H19V12ZM19 14H17V16H19V14ZM21 4H3C1.89543 4 1 4.89543 1 6V18C1 19.1046 1.89543 20 3 20H21C22.1046 20 23 19.1046 23 18V6C23 4.89543 22.1046 4 21 4ZM21 6V8H3V6H21ZM3 18V10H21V18H3Z"></path>
          </svg>
        </Link>
        <Link href="/search" className={styles.navLink} aria-label="Search">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d="M15.5 14H14.71L14.25 13.59C15.41 12.09 16.17 10.15 16.17 8.08C16.17 3.63 12.54 0 8.08 0C3.63 0 0 3.63 0 8.08C0 12.54 3.63 16.17 8.08 16.17C10.15 16.17 12.09 15.41 13.59 14.25L14 14.71V15.5L19.5 21L21 19.5L15.5 14ZM8.08 14C4.75 14 2 11.25 2 8.08C2 4.75 4.75 2 8.08 2C11.25 2 14 4.75 14 8.08C14 11.25 11.25 14 8.08 14Z"></path>
          </svg>
        </Link>
<Link href="/points" className={styles.navLink} aria-label="Points">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
    <path d="M12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12C15 13.6569 13.6569 15 12 15ZM12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17ZM18 20V22H6V20C6 17.7909 8.23858 16 12 16C15.7614 16 18 17.7909 18 20Z"></path>
  </svg>
</Link>
        <Link href="/favourites" className={styles.navLink} aria-label="Favourites">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"></path>
          </svg>
        </Link>
      </nav>

      <nav className={`${styles.navbar} ${styles.navbarBottom}`}>
        <Link href="/competitions" className={styles.navLink} aria-label="Competitions">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 11.17L17 7.5L12 3.83L7 7.5L12 11.17Z"></path>
          </svg>
        </Link>
        <Link href="/profile" className={styles.navLink} aria-label="Profile">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C7.58 14 4 15.79 4 18V20H20V18C20 15.79 16.42 14 12 14Z"></path>
          </svg>
        </Link>
        <Link href="/" className={styles.navLink} aria-label="Home">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d="M11.0001 1.00006L1.00006 9.00006V23.0001H9.00006V15.0001H15.0001V23.0001H23.0001V9.00006L13.0001 1.00006H11.0001Z"></path>
          </svg>
        </Link>

        <Link href="/bible" className={styles.navLink} aria-label="Read">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d="M21 21H7V3H21V21ZM7 21C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H21C22.1046 3 23 3.89543 23 5V19C23 20.1046 22.1046 21 21 21H7ZM3 21H1V5C1 3.89543 1.89543 3 3 3V21Z"></path>
          </svg>
        </Link>
        <Link href="/maps" className={styles.navLink} aria-label="Maps">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"></path>
          </svg>
        </Link>
      </nav>
    </div>
  );
}