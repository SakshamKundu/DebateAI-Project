import Footer from "./sections/Footer";
import Contact from "./sections/Contact";
import Hero from "./sections/Hero";
import ShowcaseSection from "./sections/ShowcaseSection";
import FeatureCards from "./sections/FeatureCards";
import Navbar from "./components/NavBar";
import Features from "./sections/Features";
import DebatePage from "./DebatePage";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import Chatbot from "./components/Chatbot";
import DebateHistorySystem, {
  DebateDetailView,
} from "./components/DebateHistorySystem";

// A new component to wrap the DebateDetailView for the new route.
// This component handles fetching the debateId from the URL and providing a navigation-based onClose handler.
const DebateDetailPage = () => {
  const { debateId } = useParams();
  const navigate = useNavigate();

  // The back button in the detail view will now navigate back in the browser's history
  const handleClose = () => {
    navigate(-1);
  };

  return <DebateDetailView debateId={debateId} onClose={handleClose} />;
};

const App = () => (
  <Router>
    <Routes>
      <Route
        path="/"
        element={
          <>
            <Navbar />
            <DebateHistorySystem>
              <main>
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
            </DebateHistorySystem>
            <Chatbot />
          </>
        }
      />
      <Route path="/debate" element={<DebatePage />} />
      {/* --- ADDED ROUTE FOR DEBATE DETAILS --- */}
      <Route path="/debates/:debateId" element={<DebateDetailPage />} />
    </Routes>
  </Router>
);

export default App;