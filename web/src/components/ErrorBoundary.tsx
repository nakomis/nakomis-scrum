import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box } from '@mui/material';
import ErrorAlert from './ErrorAlert';

interface ErrorBoundaryProps {
  children: ReactNode;
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

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
          <ErrorAlert
            title="Something went wrong"
            message="An unexpected error occurred. Please try again."
            onRetry={() => this.setState({ error: null })}
          />
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
