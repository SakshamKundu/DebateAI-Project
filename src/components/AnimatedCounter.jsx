import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/all";

import { counterItems } from "../constants";

gsap.registerPlugin(ScrollTrigger);

const AnimatedCounter = () => {
  const counterRef = useRef(null);
  const countersRef = useRef([]);

  useGSAP(() => {
    countersRef.current.forEach((counter, index) => {
      const numberElement = counter.querySelector(".counter-number");
      const item = counterItems[index];

      // Set initial value to 0
      gsap.set(numberElement, { innerText: "0" });

      // Create the counting animation
      gsap.to(numberElement, {
        innerText: item.value,
        duration: 2.5,
        ease: "power2.out",
        snap: { innerText: 1 }, // Ensures whole numbers
        scrollTrigger: {
          trigger: "#counter",
          start: "top center",
        },
        // Add the suffix after counting is complete
        onComplete: () => {
          numberElement.textContent = `${item.value}${item.suffix}`;
        },
      });

      // Add floating animation to cards
      gsap.to(counter, {
        y: -5,
        duration: 2 + Math.random() * 2,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        delay: index * 0.2,
      });
    }, counterRef);
  }, []);

  return (
    <div id="counter" ref={counterRef} className="padding-x-lg xl:mt-0 mt-32">
      <div className="text-center mb-16">
        {/* Separator line */}
        <div className="w-36 h-0.5 bg-gradient-to-r from-transparent via-violet-600 to-transparent mx-auto mb-8"></div>
        
        <h2 className="text-4xl font-bold text-white mb-4">
          Our Platform in Numbers
        </h2>
        <p className="text-white-50 text-xl">
          Trusted by debaters worldwide to sharpen their skills
        </p>
      </div>

      <div className="mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {counterItems.map((item, index) => (
          <div
            key={index}
            ref={(el) => el && (countersRef.current[index] = el)}
            className="relative group overflow-hidden"
          >
            {/* Main card with gradient background */}
            <div className="relative bg-gradient-to-br from-debate-blue/20 via-brand-blue/10 to-purple-900/20 rounded-xl p-8 flex flex-col items-center text-center border border-white/20 hover:border-brand-blue/50 transition-all duration-500 backdrop-blur-sm">
              
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
              
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-blue/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10"></div>
              
              {/* Moving reflection effect */}
              <div className="absolute inset-0 rounded-xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-30 animate-pulse"></div>
                <div 
                  className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                  style={{
                    animation: `slideReflection ${4 + index * 0.5}s ease-in-out infinite`,
                  }}
                ></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="counter-number text-transparent bg-clip-text bg-gradient-to-r from-brand-blue via-blue-400 to-cyan-400 text-5xl font-bold mb-3 drop-shadow-lg">
                  0{item.suffix}
                </div>
                <div className="text-white text-lg font-medium drop-shadow-sm">{item.label}</div>
              </div>

              {/* Corner shine effect */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full opacity-50"></div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slideReflection {
          0% {
            transform: translateX(-100%) skewX(12deg);
          }
          50% {
            transform: translateX(200%) skewX(12deg);
          }
          100% {
            transform: translateX(-100%) skewX(12deg);
          }
        }
      `}</style>
    </div>
  );
};

export default AnimatedCounter;