import styles from './FeatureGrid.module.css';

export type Feature = { id: string; title: string; body: string };

export function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <section className={styles.section} aria-labelledby="features-heading">
      <h2 id="features-heading">What you get</h2>
      <ul className={styles.grid}>
        {features.map((f) => (
          <li key={f.id} className={styles.card}>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
