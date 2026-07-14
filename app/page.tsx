import type { Metadata } from "next";
import { Header } from "./components/Header";
import HeroSection from "./components/Hero";
import { ProblemSolution } from "./components/ProblemSolution";
import { WhyBase } from "./components/WhyBase";
import { HowItWorks } from "./components/HowItWorks";
import { Economics } from "./components/Economics";
import { Roadmap } from "./components/Roadmap";
import { Vision } from "./components/Vision";
import { Footer } from "./components/Footer";

const SITE_URL = "https://steadystake.org";

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <div className="landing-pattern-bg">
          <ProblemSolution />
          <WhyBase />
          <HowItWorks />
          <Economics />
          <Roadmap />
          <Vision />
          <Footer />
        </div>
      </main>
    </>
  );
}
