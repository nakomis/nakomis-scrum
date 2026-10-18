import { useEffect } from 'react';
import { CircularProgress } from '@mui/material';
import ErrorAlert from '../components/ErrorAlert';
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

  // The raw OIDC error is for developers; the admin sees a plain message.
  useEffect(() => {
    if (auth.error) console.error('Sign-in callback failed:', auth.error);
  }, [auth.error]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#282c34' }}>
      {auth.isLoading && <CircularProgress />}
      {auth.error && (
        <ErrorAlert
          title="Sign-in failed"
          message="We couldn't complete sign-in. Please try again."
          onRetry={() => auth.signinRedirect()}
          retryLabel="Try again"
        />
      )}
    </div>
  );
};

export default AuthCallbackPage;
