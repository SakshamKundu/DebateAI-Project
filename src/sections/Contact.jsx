import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";

import TitleHeader from "../components/TitleHeader";

const Contact = () => {
  const formRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await emailjs.sendForm(
        import.meta.env.VITE_APP_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_APP_EMAILJS_TEMPLATE_ID,
        formRef.current,
        import.meta.env.VITE_APP_EMAILJS_PUBLIC_KEY
      );

      alert("Thank you! Your message has been sent successfully.");
      setForm({ name: "", email: "", message: "" });
    } catch (error) {
      console.error("EmailJS Error:", error);
      alert("Something went wrong. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="flex-center section-padding">
      <div className="w-full max-w-screen-xl mx-auto md:px-10 px-5">
        <TitleHeader
          title="Get in Touch - Let's Connect"
          sub="💬 Have questions or ideas? Let's talk! 🚀"
        />

        {/* Switched to a balanced 2-column grid for a better layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 mt-16 items-start">
          {/* Left Column: The Contact Form */}
          <div className="w-full">
            <div className="card-border rounded-xl p-8">
              <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="w-full flex flex-col gap-7"
              >
                <div>
                  <label htmlFor="name">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="What's your good name?"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email">
                    Your Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="What's your email address?"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                  >
                    Your Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="How can I help you?"
                    rows="5"
                    required
                  />
                </div>

                <button type="submit" disabled={loading}>
                  <div className="cta-button group">
                    <div className="bg-circle" />
                    {/* The text inside the button uses the theme's colors */}
                    <p className="text">
                      {loading ? "Sending..." : "Send Message"}
                    </p>
                  </div>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Informational Text */}
          <div className="lg:mt-8">
            <h2 className="text-4xl font-bold text-gray-200 leading-tight">
              We're Eager to Hear
              <span className="text-white-50"> From You</span>.
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              Your feedback is the cornerstone of our platform's evolution.
              Whether you have a question, a suggestion for a new feature, or a
              proposal for a partnership, our team is ready to connect and
              explore the possibilities.
            </p>
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-xl font-semibold text-gray-200">
                Support & General Inquiries
              </h3>
              <p className="mt-2 text-gray-400">
                For all questions and support requests, please use the form, or
                email our team directly at:
              </p>
              <a
                href="mailto:support@yourdebateplatform.com"
                className="text-lg text-gray-300 font-medium hover:underline"
              >
                support@yourdebateplatform.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
