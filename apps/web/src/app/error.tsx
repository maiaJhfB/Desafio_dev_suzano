'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="startup-screen" role="alert">
      <span className="brand-mark">a.</span>
      <h1>Algo saiu do lugar.</h1>
      <p>Recarregue esta página para continuar explorando.</p>
      <button className="button button-primary" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
