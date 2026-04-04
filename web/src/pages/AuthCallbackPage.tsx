import { useEffect } from 'react';
import { CircularProgress, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      navigate('/admin');
    }
  }, [auth.isLoading, auth.isAuthenticated, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#282c34' }}>
      {auth.isLoading && <CircularProgress />}
      {auth.error && <Typography color="error">{auth.error.message}</Typography>}
    </div>
  );
};

export default AuthCallbackPage;
