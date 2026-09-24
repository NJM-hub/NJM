import { EntryPicker } from "@/components/site/EntryPicker";
import { getSiteInfo } from "@/lib/site/info";

export default async function Home() {
  const info = await getSiteInfo();
  return (
    <main className="site flex min-h-screen items-center justify-center px-5 py-14">
      <EntryPicker info={info} />
    </main>
  );
}
