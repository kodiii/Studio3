import type { Missing } from './types';
import styles from './styles.module.css';
import { helper } from './helper';
export default function X() { return <div className={styles.x}>{String(helper as Missing)}</div>; }
