import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from 'react-oidc-context';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import HomePage from './pages/HomePage';
import JoinSessionPage from './pages/JoinSessionPage';
import SessionPage from './pages/SessionPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminSessionPage from './pages/AdminSessionPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import NotFoundPage from './pages/NotFoundPage';

const oidcConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
  scope: 'openid profile email',
  response_type: 'code',
};

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#282c34',
      paper: '#1f2329',
    },
    primary: {
      main: '#4d9de0',
    },
    secondary: {
      main: '#f59e0b',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});

const App: React.FC = () => {
  return (
    <AuthProvider {...oidcConfig}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/join" element={<JoinSessionPage />} />
            <Route path="/session/:sessionId" element={<SessionPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/session/:sessionId" element={<AdminSessionPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
