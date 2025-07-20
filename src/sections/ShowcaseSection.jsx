// src/sections/ShowcaseSection.jsx

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import FluidCanvas from '../components/FluidCanvas'; // Import the new component
import './ShowcaseSection.css'; // Import a new CSS file

gsap.registerPlugin(ScrollTrigger);

const AppShowcase = () => {
  const sectionRef = useRef(null);
  const showRef = useRef(null);
  const libraryRef = useRef(null);
  const ycDirectoryRef = useRef(null);

  useGSAP(() => {
    // Animation for the main section
    gsap.fromTo(
      sectionRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.5 }
    );

    // Animations for each app showcase
    const cards = [showRef.current, libraryRef.current, ycDirectoryRef.current];

    cards.forEach((card, index) => {
      gsap.fromTo(
        card,
        {
          y: 50,
          opacity: 0,
        },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          delay: 0.3 * (index + 1),
          scrollTrigger: {
            trigger: card,
            start: "top bottom-=100",
          },
        }
      );
    });
  }, []);

  return (
    <div id="work" ref={sectionRef} className="app-showcase">
      <FluidCanvas />
      <div className="w-full">
        <div className="showcaselayout">
          <div ref={showRef} className="first-project-wrapper">
            <div className="image-wrapper">
              <img src="/images/interface.png" alt="App Interface" />
            </div>
            <div className="text-content">
              <h2>
                Real-Time AI Debate Practice
              </h2>
              <p className="text-white-50 md:text-xl">
                Experience lifelike BP/AP debates with adaptive AI opponents, 
                timed speeches, and automatic adjudication feedback.
              </p>
            </div>
          </div>

          <div className="project-list-wrapper overflow-hidden">
            <div className="project" ref={libraryRef}>
              <div className="image-wrapper bg-[#FFEFDB]">
                <img
                  src="/images/asian-parliament.jpg"
                  alt="Library Management Platform"
                />
              </div>
              <h2>Asian Parliament Style</h2>
            </div>

            <div className="project" ref={ycDirectoryRef}>
              <div className="image-wrapper bg-[#FFE7EB]">
                <img src="/images/british-parliament.jpeg" alt="YC Directory App" />
              </div>
              <h2>British Parliament Style</h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppShowcase;
