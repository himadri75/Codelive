import { Suspense, lazy, useContext, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import Footer from "./pages/Footer";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FeaturesSection from "./pages/FeaturePage";
import FAQSection from "./pages/FAQs";
import ContactUsSection from "./pages/ContactUs";
import { authContext } from "./context/AuthContextProvider";
import { AlertTriangle } from "lucide-react";
import AuthPage from "./pages/AuthPage";

// Lazy load CodeSpace to reduce initial bundle size (Monaco Editor is heavy)
const CodeSpace = lazy(() => import("./pages/CodeSpace"));

const App = () => {
  const { getUserDetails } = useContext(authContext);
  const [serverDown, setServerDown] = useState(false);

  // Hydrate user once
  useEffect(() => {
    getUserDetails();
  }, []); // intentionally empty deps so it runs once

  // Ping backend once on mount (consider env var later)
  useEffect(() => {
    const backendBase = import.meta.env.VITE_API_URL || "http://localhost:8080";
    fetch(`${backendBase}/healthz`) // expects 200 OK
      .then((res) => {
        if (res.ok) setServerDown(false);
      })
      .catch(() => setServerDown(true));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {serverDown && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-green-100 border border-green-300 text-green-900 px-6 py-6 rounded-md shadow max-w-lg w-full text-center">
            <button
              className="absolute top-3 right-3 text-yellow-900 hover:text-yellow-600 transition"
              aria-label="Close server down warning"
              onClick={() => setServerDown(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-green-800 mr-2" />
              <h2 className="text-xl font-semibold">Server is Down</h2>
            </div>
            <p className="text-sm sm:text-base mb-4">
              Oops! Some features may not work right now. This happens when the
              backend server is sleeping or under maintenance. Please try again
              later or check the GitHub Profile.
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href="https://github.com/karanhimadri/Codellive----Real_Time_Code-Sharing_Platform.git"
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer inline-block bg-green-50 hover:bg-green-100 text-green-900 px-5 py-2 border border-green-500 text-sm font-medium transition-colors"
              >
                GitHub
              </a>
              <button
                onClick={() => {
                  setServerDown(false);
                  window.location.href = "/contact";
                }}
                className="inline-block bg-green-50 hover:bg-green-100 text-green-900 px-5 py-2 border border-green-500 text-sm font-medium transition-colors"
              >
                Contact
              </button>
            </div>
          </div>
        </div>
      )}
      <Navbar />
      <AuthPage />
      <main className="flex-1 pt-16 lg:pt-20">
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[60vh] bg-gray-900">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
                <p className="mt-4 text-white text-lg">
                  Loading Code Editor...
                </p>
              </div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/code-space" element={<CodeSpace />} />
            <Route path="/features" element={<FeaturesSection />} />
            <Route path="/faqs" element={<FAQSection />} />
            <Route path="/contact" element={<ContactUsSection />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <ToastContainer
        autoClose={2500}
        toastClassName="flex items-center space-x-2 px-4 py-2"
        bodyClassName="flex items-center"
      />
    </div>
  );
};

export default App;
