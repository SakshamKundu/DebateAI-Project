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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 mt-16 items-start">
          {/* Left Column: The Contact Form */}
          <div className="w-full">
            <div className="card-border rounded-xl p-8 hover:bg-black-100/35 transition-all duration-300">
              <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="w-full flex flex-col gap-7"
              >
                <div>
                  <label 
                    htmlFor="name"
                    className="block text-white text-lg font-medium mb-3"
                  >
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
                    className="w-full px-4 py-3 bg-black-100 border border-white-50/20 rounded-lg text-white placeholder-white-50/60 focus:outline-none focus:border-white-50/40 transition-all duration-300"
                  />
                </div>

                <div>
                  <label 
                    htmlFor="email"
                    className="block text-white text-lg font-medium mb-3"
                  >
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
                    className="w-full px-4 py-3 bg-black-100 border border-white-50/20 rounded-lg text-white placeholder-white-50/60 focus:outline-none focus:border-white-50/40 transition-all duration-300"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-white text-lg font-medium mb-3"
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
                    className="w-full px-4 py-3 bg-black-100 border border-white-50/20 rounded-lg text-white placeholder-white-50/60 focus:outline-none focus:border-white-50/40 transition-all duration-300 resize-none"
                  />
                </div>

                <button type="submit" disabled={loading}>
                  <div className="cta-button group">
                    <div className="bg-circle" />
                    <p className="text">
                      {loading ? "Sending..." : "Send Message"}
                    </p>
                  </div>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Informational Text */}
          <div className="lg:mt-8 space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-white leading-tight mb-6">
                We're Eager to Hear
                <span className="text-white-50"> From You</span>.
              </h2>
              <p className="text-white-50 text-lg leading-relaxed">
                Your feedback is the cornerstone of our platform's evolution.
                Whether you have a question, a suggestion for a new feature, or a
                proposal for a partnership, our team is ready to connect and
                explore the possibilities.
              </p>
            </div>

            {/* Feature-style cards */}
            <div className="grid grid-cols-1 gap-6">
              <div className="card-border rounded-xl p-6 hover:bg-black-200 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="size-12 flex items-center justify-center rounded-full bg-white-50/10 p-3 mt-1">
                    <svg className="w-6 h-6 text-white-50" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white text-xl font-semibold mb-2">Quick Response</h3>
                    <p className="text-white-50">We typically respond within 24 hours to all inquiries</p>
                  </div>
                </div>
              </div>

              <div className="card-border rounded-xl p-6 hover:bg-black-200 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="size-12 flex items-center justify-center rounded-full bg-white-50/10 p-3 mt-1">
                    <svg className="w-6 h-6 text-white-50" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white text-xl font-semibold mb-2">Privacy & Security</h3>
                    <p className="text-white-50">Your information is protected and never shared with third parties</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact information */}
            <div className="card-border rounded-xl p-6 hover:bg-black-200 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="size-12 flex items-center justify-center rounded-full bg-white-50/10 p-3 mt-1">
                  <svg className="w-6 h-6 text-white-50" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white text-xl font-semibold mb-2">Support & General Inquiries</h3>
                  <p className="text-white-50 mb-3">
                    For all questions and support requests, please use the form, or
                    email our team directly at:
                  </p>
                  <a
                    href="mailto:support@yourdebateplatform.com"
                    className="text-brand-blue hover:underline font-medium"
                  >
                    support@yourdebateplatform.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;