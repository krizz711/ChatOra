import { ChevronLeft } from 'lucide-react';
import styles from './PageBack.module.css';

export default function PageBack({ label = 'Back', onClick, className = '' }) {
  return (
    <button type="button" className={`${styles.back} ${className}`} onClick={onClick} aria-label={label}>
      <span className={styles.iconWrap}>
        <ChevronLeft size={20} strokeWidth={2.5} />
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
