import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { AppProvider } from './context/AppContext';
import { LandingPage } from './pages/LandingPage';
import { EnhancePage } from './pages/EnhancePage';
import { EvaluationPage } from './pages/EvaluationPage';
import { AboutPage } from './pages/AboutPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/enhance" element={<EnhancePage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  );
}
