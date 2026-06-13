import { SiteNav } from "@/components/site-nav";
import { MoneyShot } from "@/components/money-shot";

export default function Home() {
  return (
    <>
      <SiteNav active="Ward" />
      <main className="flex-1">
        <MoneyShot />
      </main>
    </>
  );
}
