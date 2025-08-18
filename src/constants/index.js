export const navLinks = [
  {
    name: "Features",
    link: "#features", // Points to the section with id="features"
  },
  {
    name: "Format",
    link: "#format-showcase", // Points to the ShowcaseSection
  },
  {
    name: "How it works",
    link: "#format-showcase", // Also points to the ShowcaseSection
  },
];


const words = [
  { text: "Rebuttals", imgPath: "/images/rebuttals.svg" },
  { text: "POIs", imgPath: "/images/poi.svg" }, // (Point of Information)
  { text: "Case-Building", imgPath: "/images/case.svg" },
  { text: "Whips", imgPath: "/images/whip.svg" },
  { text: "Logic", imgPath: "/images/logic.svg" },
  { text: "Rhetoric", imgPath: "/images/rhetoric.svg" },
  { text: "Adjudication", imgPath: "/images/adjudication.svg" },
  { text: "Motions", imgPath: "/images/motions.svg" },
];

const counterItems = [
  { 
    value: 50, 
    suffix: "+", 
    label: "Debate Motions" 
  },
  { 
    value: 100, 
    suffix: "+", 
    label: "Practice Rounds Hosted" 
  },
  { 
    value: 95, 
    suffix: "%", 
    label: "User Satisfaction Rate" 
  },
  { 
    value: 24, 
    suffix: "/7", 
    label: "AI Availability" 
  },
];

const debateFeatures = [
  {
    imgPath: "/images/adjudicator.svg", // Judge icon or gavel
    title: "Expert Adjudication",
    desc: "Receive tournament-level feedback on logic, rhetoric, and strategy after each round.",
  },
  {
    imgPath: "/images/opponent.svg", // AI avatar icon
    title: "Adaptive Opponents",
    desc: "AI debaters that adjust difficulty based on your skill level - from novice to world champion.",
  },
  {
    imgPath: "/images/timer.svg", // Debate timer icon
    title: "Real-Time Practice",
    desc: "Full BP/AP format timing with POIs, protected time, and automatic speech clocks.",
  },
];

const techStackImgs = [
  {
    name: "React Developer",
    imgPath: "/images/logos/react.png",
  },
  {
    name: "Python Developer",
    imgPath: "/images/logos/python.svg",
  },
  {
    name: "Backend Developer",
    imgPath: "/images/logos/node.png",
  },
  {
    name: "Interactive Developer",
    imgPath: "/images/logos/three.png",
  },
  {
    name: "Project Manager",
    imgPath: "/images/logos/git.svg",
  },
];

const techStackIcons = [
  {
    name: "React Developer",
    modelPath: "/models/react_logo-transformed.glb",
    scale: 1,
    rotation: [0, 0, 0],
  },
  {
    name: "Python Developer",
    modelPath: "/models/python-transformed.glb",
    scale: 0.8,
    rotation: [0, 0, 0],
  },
  {
    name: "Backend Developer",
    modelPath: "/models/node-transformed.glb",
    scale: 5,
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    name: "Interactive Developer",
    modelPath: "/models/three.js-transformed.glb",
    scale: 0.05,
    rotation: [0, 0, 0],
  },
  {
    name: "Project Manager",
    modelPath: "/models/git-svg-transformed.glb",
    scale: 0.05,
    rotation: [0, -Math.PI / 4, 0],
  },
];

const featureCards = [
  {
    review: "Our AI opponents adapt to your skill level, providing the perfect challenge whether you're a novice or a seasoned debater.",
    logoPath: "/images/parliament.svg", // British Parliament logo
    title: "Adaptive AI Opponents",
    date: "Always Available", // Replacing dates
    responsibilities: [
      "Simulates realistic PM, LO, and Whip roles",
      "Adjusts difficulty based on your performance",
      "Provides contextual Point of Information (POI)",
    ],
  },
  {
    review: "Get instant, detailed feedback on your arguments, delivery, and strategy - just like a human adjudicator would.",
    logoPath: "/images/adjudication.svg", // Asian Parliament logo
    title: "Expert Adjudication",
    date: "24/7 Feedback",
    responsibilities: [
      "Scores on logic, rhetoric, and structure",
      "Highlights strengths and weaknesses",
      "Compares to tournament standards",
    ],
  },
  {
    review: "Practice anytime with our library of motions and customizable debate formats.",
    logoPath: "/images/practice.svg", // WSDC logo
    title: "Unlimited Practice",
    date: "50+ Motions",
    responsibilities: [
      "British & Asian Parliament formats",
      "Time limit customization",
      "Motion difficulty levels",
    ],
  },
];

const expLogos = [
  {
    name: "logo1",
    imgPath: "/images/logo1.png",
  },
  {
    name: "logo2",
    imgPath: "/images/logo2.png",
  },
  {
    name: "logo3",
    imgPath: "/images/logo3.png",
  },
];

const socialImgs = [
  {
    name: "insta",
    imgPath: "/images/insta.svg",
  },
  {
    name: "fb",
    imgPath: "/images/fb.svg",
  },
  {
    name: "x",
    imgPath: "/images/twitter.svg",
  },
  {
    name: "linkedin",
    imgPath: "/images/linkedin.svg",
  },
];

export {
  words,
  debateFeatures,
  counterItems,
  featureCards,
  expLogos,
  socialImgs,
  techStackIcons,
  techStackImgs,
};
