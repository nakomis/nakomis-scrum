import { useEffect, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import { currentReturnTo, type SigninState } from './returnTo';

// oidc-client-ts renews the access token with the refresh token shortly before it
// expires (automaticSilentRenew). A failed renewal is often a transient network blip,
// so it is only logged; when the token then expires we try one more silent renewal
// and only send the admin back to sign in if that fails too.
const TokenRefreshHandler: React.FC = () => {
  const auth = useAuth();
  // Latest auth methods without re-subscribing to events on every render.
  const authRef = useRef(auth);
  authRef.current = auth;
  const redirectingRef = useRef(false);
  const { events } = auth;

  useEffect(() => {
    const reauthenticate = async () => {
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      try {
        await authRef.current.removeUser();
        const state: SigninState = { returnTo: currentReturnTo() };
        await authRef.current.signinRedirect({ state });
      } catch (error) {
        redirectingRef.current = false;
        console.error('Failed to redirect to sign-in:', error);
      }
    };

    const onExpired = async () => {
      if (redirectingRef.current) return;
      try {
        const user = await authRef.current.signinSilent();
        if (!user) await reauthenticate();
      } catch (error) {
        console.warn('Silent renewal after expiry failed; signing in again:', error);
        await reauthenticate();
      }
    };

    const removeRenewError = events.addSilentRenewError((error) => {
      console.warn('Silent token renewal failed; will retry when the token expires:', error);
    });
    const removeExpired = events.addAccessTokenExpired(() => {
      void onExpired();
    });

    return () => {
      removeRenewError();
      removeExpired();
    };
  }, [events]);

  return null;
};

export default TokenRefreshHandler;
