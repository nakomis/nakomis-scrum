import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, AlertTitle, Box, Button, Stack } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: ReactNode;
  // Changing this clears a caught error, e.g. when the user navigates elsewhere.
  resetKey?: string;
  onGoHome?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const { onGoHome } = this.props;
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
          <Alert
            severity="error"
            action={(
              <Stack direction="row" spacing={1}>
                <Button color="inherit" size="small" onClick={() => this.setState({ error: null })}>
                  Retry
                </Button>
                {onGoHome && (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      this.setState({ error: null });
                      onGoHome();
                    }}
                  >
                    Go home
                  </Button>
                )}
              </Stack>
            )}
          >
            <AlertTitle>Something went wrong</AlertTitle>
            An unexpected error occurred. Please try again.
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

// Must sit inside <Router>: resets the boundary on navigation and offers a way home.
const RoutedErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ErrorBoundary resetKey={location.key} onGoHome={() => navigate('/')}>
      {children}
    </ErrorBoundary>
  );
};

export default RoutedErrorBoundary;
