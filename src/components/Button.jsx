/**
 * A reusable CTA button component.
 * When clicked, it scrolls smoothly to the section with ID "counter",
 * with a small offset from the top for better visual placement.
 */

const Button = ({ text, className, id }) => {
  const setOrigin = (e) => {
    const button = e.currentTarget;
    const circle = button.querySelector(".bg-circle");
    const rect = button.getBoundingClientRect();

    // Calculate cursor position relative to button
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to percentage for transform origin
    const x = (mouseX / rect.width) * 100;
    const y = (mouseY / rect.height) * 100;

    // Set transform origin for the circle to shrink towards cursor
    circle.style.transformOrigin = `${x}% ${y}%`;
  };

  return (
    <a
      href={"/debate"} // Default URL
      target="_blank" // Opens in new tab
      rel="noopener noreferrer"
      onMouseMove={setOrigin}

      className={`${className ?? ""} cta-wrapper group`}
    >
      <div className="cta-button">
        <div className="bg-circle" />
        <p className="text">{text}</p>
      </div>
    </a>
  );
};

export default Button;
