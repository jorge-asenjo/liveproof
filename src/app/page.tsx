export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <p className="text-sm uppercase tracking-widest text-neutral-500">Work in progress · PayPal sandbox</p>
      <h1 className="text-4xl font-semibold leading-tight">
        Your PayPal payment only goes to the person who just proved, live on camera, that they have the item.
      </h1>
      <p className="text-lg text-neutral-600">
        For strangers trading on Reddit, Marketplace and forums, where AI-made &quot;proof&quot; photos and swapped
        PayPal accounts are now common.
      </p>
      <a
        href="/sell"
        className="w-fit rounded-full bg-[#0070e0] px-6 py-3 font-medium text-white hover:bg-[#005ea6]"
      >
        I&apos;m selling: start a live proof
      </a>
    </main>
  );
}
