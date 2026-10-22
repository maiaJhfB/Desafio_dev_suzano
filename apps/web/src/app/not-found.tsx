import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="startup-screen">
      <span className="brand-mark">a.</span>
      <h1>Esse caminho ainda está vazio.</h1>
      <p>Volte para o catálogo e encontre novas boas escolhas.</p>
      <Link className="button button-primary" href="/produtos">
        Ir para o catálogo
      </Link>
    </main>
  );
}
