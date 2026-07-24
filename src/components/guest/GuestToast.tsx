"use client";

import styles from "./guest-theme.module.css";

export function GuestToast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="status" className={styles.toast}>
      {message}
    </div>
  );
}
