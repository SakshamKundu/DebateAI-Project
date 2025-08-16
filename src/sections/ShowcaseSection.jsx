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
  const fluidCanvasRef = useRef(null);

  // Function to simulate mouse interaction on FluidCanvas
  const simulateFluidInteraction = () => {
    const canvas = fluidCanvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Create multiple interaction points for a more dynamic effect
    const interactions = [
      { x: centerX, y: centerY * 0.7, delay: 0 },
      { x: centerX * 1.3, y: centerY * 1.2, delay: 0.5 },
      { x: centerX * 0.7, y: centerY * 1.3, delay: 1 },
      { x: centerX * 1.2, y: centerY * 0.8, delay: 1.5 }
    ];

    interactions.forEach(({ x, y, delay }) => {
      setTimeout(() => {
        // Simulate mouse events
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          clientX: rect.left + x,
          clientY: rect.top + y,
          bubbles: true
        });
        
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: rect.left + x,
          clientY: rect.top + y,
          bubbles: true
        });

        canvas.dispatchEvent(mouseEnterEvent);
        canvas.dispatchEvent(mouseMoveEvent);

        // Add a slight movement animation
        gsap.to({}, {
          duration: 0.3,
          onUpdate: function() {
            const progress = this.progress();
            const offsetX = Math.sin(progress * Math.PI * 2) * 30;
            const offsetY = Math.cos(progress * Math.PI * 2) * 20;
            
            const moveEvent = new MouseEvent('mousemove', {
              clientX: rect.left + x + offsetX,
              clientY: rect.top + y + offsetY,
              bubbles: true
            });
            canvas.dispatchEvent(moveEvent);
          }
        });
      }, delay * 1000);
    });
  };

  useGSAP(() => {
    // Animation for the main section
    gsap.fromTo(
      sectionRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.5 }
    );

    // ScrollTrigger for automatic fluid interaction
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top center",
      end: "bottom center",
      onEnter: () => {
        // Delay the interaction slightly after the section comes into view
        setTimeout(() => {
          simulateFluidInteraction();
        }, 300);
      },
      onEnterBack: () => {
        // Also trigger when scrolling back up into the section
        setTimeout(() => {
          simulateFluidInteraction();
        }, 800);
      }
    });

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
      <div ref={fluidCanvasRef}>
        <FluidCanvas />
      </div>
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