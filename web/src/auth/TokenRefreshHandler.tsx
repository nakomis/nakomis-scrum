import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';

// oidc-client-ts renews the access token with the refresh token shortly before it
// expires (automaticSilentRenew). If renewal fails, or the token expires anyway
// (e.g. the tab was asleep), drop the stale user and send the admin back to sign in.
const TokenRefreshHandler: React.FC = () => {
  const auth = useAuth();

  useEffect(() => {
    const reauthenticate = async () => {
      try {
        await auth.removeUser();
        await auth.signinRedirect();
      } catch (error) {
        console.error('Failed to redirect to sign-in:', error);
      }
    };

    const onExpired = async () => {
      try {
        await auth.signinSilent();
      } catch {
        await reauthenticate();
      }
    };

    const removeRenewError = auth.events.addSilentRenewError(() => {
      void reauthenticate();
    });
    const removeExpired = auth.events.addAccessTokenExpired(() => {
      void onExpired();
    });

    return () => {
      removeRenewError();
      removeExpired();
    };
  }, [auth]);

  return null;
};

export default TokenRefreshHandler;
