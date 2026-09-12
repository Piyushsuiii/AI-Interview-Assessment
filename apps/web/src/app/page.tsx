import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { InteractiveInterviewDemo } from "@/components/landing/InteractiveInterviewDemo";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingEssentials } from "@/components/landing/LandingEssentials";
import { Footer } from "@/components/landing/Footer";
import { CandidateIntelligenceCore } from "@/components/landing/CandidateIntelligenceCore";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#111111] text-[#f0ede8] selection:bg-[#ff4d1c]/30 selection:text-white">
      <Navbar />
      <HeroSection />
      <CandidateIntelligenceCore />
      <InteractiveInterviewDemo />
      <LandingFeatures />
      <LandingEssentials />
      <Footer />
    </main>
  );
}
