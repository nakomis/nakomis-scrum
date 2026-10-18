import { Alert, AlertTitle, Button } from '@mui/material';

interface ErrorAlertProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, title, onRetry, retryLabel = 'Retry' }) => (
  <Alert
    severity="error"
    sx={{ my: 2 }}
    action={onRetry && (
      <Button color="inherit" size="small" onClick={onRetry}>
        {retryLabel}
      </Button>
    )}
  >
    {title && <AlertTitle>{title}</AlertTitle>}
    {message}
  </Alert>
);

export default ErrorAlert;
