import Footer from "./sections/Footer";
import Contact from "./sections/Contact";
import Hero from "./sections/Hero";
import ShowcaseSection from "./sections/ShowcaseSection";
import FeatureCards from "./sections/FeatureCards";
import Navbar from "./components/NavBar";
import Features from "./sections/Features";
import DebatePage from "./DebatePage";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

const App = () => (
  <Router>
    <Routes>
      <Route
        path="/"
        element={
          <>
            <Navbar />
            <main>
              {" "}
              <section id="hero">
                <Hero />
              </section>
              <section id="format-showcase">
                <ShowcaseSection />
              </section>
              <FeatureCards />
              <section id="features">
                <Features />
              </section>
              <section id="contact">
                <Contact />
              </section>
              <Footer />
            </main>
          </>
        }
      />
      <Route path="/debate" element={<DebatePage />} />
    </Routes>
  </Router>
);

export default App;
