import HomeClient from "@/components/home/home-client";
import TopNav from "@/components/top-nav";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <HomeClient />
    </div>
  );
}
