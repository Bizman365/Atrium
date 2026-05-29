export default function Forbidden() {
  return (
    <main className="min-h-screen bg-pexlo-paper px-6 py-16 text-pexlo-ink">
      <div className="mx-auto max-w-2xl border-t border-pexlo-hairline pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pexlo-terracotta-deep">403</p>
        <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Access unavailable</h1>
        <p className="mt-6 leading-7 text-pexlo-ink-soft">
          This project exists, but your account is not a member of its organization. Ask Pexlo to send an invite
          to the email address you used to sign in.
        </p>
      </div>
    </main>
  );
}
