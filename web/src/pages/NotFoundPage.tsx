import { Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#282c34', color: '#ffffff' }}>
      <Typography variant="h4" gutterBottom>404 - Page Not Found</Typography>
      <Button variant="contained" onClick={() => navigate('/')}>Go Home</Button>
    </div>
  );
};

export default NotFoundPage;
