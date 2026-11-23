import { demos, effects } from '@studio3/library/registry';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="s3-display text-6xl">Studio<sup>3</sup></h1>
      <ul className="mt-8 grid gap-2">
        {effects.map((e) => <li key={e.meta.id}><Link className="underline" href={`/effects/${e.meta.id}`}>{e.meta.name}</Link></li>)}
        {demos.map((d) => <li key={d.meta.id}><Link className="underline" href={`/demos/${d.meta.specialty}/${d.meta.id}`}>{d.meta.name}</Link></li>)}
      </ul>
    </main>
  );
}
