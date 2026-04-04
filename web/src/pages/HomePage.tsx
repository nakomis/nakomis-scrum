import { Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#282c34', color: '#ffffff' }}>
      <Typography variant="h3" gutterBottom>nakomis-scrum</Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>Real-time scrum facilitation tools</Typography>
      {auth.isAuthenticated ? (
        <Button variant="contained" onClick={() => navigate('/admin')}>Go to Dashboard</Button>
      ) : (
        <Button variant="contained" onClick={() => auth.signinRedirect()}>Sign In</Button>
      )}
    </div>
  );
};

export default HomePage;
