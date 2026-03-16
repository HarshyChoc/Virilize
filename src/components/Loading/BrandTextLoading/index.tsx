import { BRANDING_NAME } from '@lobechat/business-const';

import styles from './index.module.css';

interface BrandTextLoadingProps {
  debugId: string;
}

const BrandTextLoading = ({ debugId }: BrandTextLoadingProps) => {
  const showDebug = process.env.NODE_ENV === 'development' && debugId;

  return (
    <div className={styles.container}>
      <div aria-label="Loading" className={styles.brand} role="status">
        <div className={styles.wordmark} data-text={BRANDING_NAME}>
          {BRANDING_NAME.split('').map((char, index) => (
            <span
              className={styles.letter}
              key={`${char}-${index}`}
              style={{ animationDelay: `${index * 0.04}s` }}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
      {showDebug && (
        <div className={styles.debug}>
          <div className={styles.debugRow}>
            <code>Debug ID:</code>
            <span className={styles.debugTag}>
              <code>{debugId}</code>
            </span>
          </div>
          <div className={styles.debugHint}>only visible in development</div>
        </div>
      )}
    </div>
  );
};

export default BrandTextLoading;
