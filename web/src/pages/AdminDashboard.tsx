import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Typography, AppBar, Toolbar,
  Drawer, List, ListItem, ListItemText, CircularProgress, Skeleton,
} from '@mui/material';
import ListItemButton from '@mui/material/ListItemButton';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import ErrorAlert from '../components/ErrorAlert';

interface SessionSummary {
  id: string;
  sessionId: string;
  status: string;
}

interface NameListSummary {
  id: string;
  name: string;
  names: string[];
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [nameLists, setNameLists] = useState<NameListSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [nameListsLoading, setNameListsLoading] = useState(false);
  const [nameListsError, setNameListsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const accessToken = auth.user?.access_token;
  const orgId = location.state?.orgId as string | undefined;

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSessions(await response.json());
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessionsError('Could not load sessions.');
    } finally {
      setSessionsLoading(false);
    }
  }, [accessToken]);

  const fetchNameLists = useCallback(async () => {
    if (!orgId) return;
    setNameListsLoading(true);
    setNameListsError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/orgs/${orgId}/name-lists`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setNameLists(await response.json());
    } catch (error) {
      console.error('Failed to fetch name lists:', error);
      setNameListsError('Could not load name lists.');
    } finally {
      setNameListsLoading(false);
    }
  }, [accessToken, orgId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetchNameLists();
  }, [fetchNameLists]);

  const createSession = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Session' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const session = await res.json();
      navigate(`/admin/session/${session.sessionId}`);
    } catch (error) {
      console.error('Failed to create session:', error);
      setCreateError('Could not create a new session.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" anchor="left">
        {nameListsError && <ErrorAlert message={nameListsError} onRetry={fetchNameLists} />}
        <List>
          {nameListsLoading
            ? [0, 1, 2].map((i) => (
              <ListItem key={i}>
                <ListItemText primary={<Skeleton width={120} />} secondary={<Skeleton width={60} />} />
              </ListItem>
            ))
            : nameLists.map((list) => (
              <ListItemButton key={list.id} onClick={() => navigate(`/admin/name-list/${list.id}`)}>
                <ListItemText primary={list.name} secondary={`Count: ${list.names.length}`} />
              </ListItemButton>
            ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Button
          variant="contained"
          onClick={createSession}
          disabled={creating}
          startIcon={creating ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Create New Session
        </Button>
        {createError && <ErrorAlert message={createError} onRetry={createSession} />}
        {sessionsError ? (
          <ErrorAlert message={sessionsError} onRetry={fetchSessions} />
        ) : (
          <List>
            {sessionsLoading
              ? [0, 1, 2].map((i) => (
                <ListItem key={i}>
                  <ListItemText primary={<Skeleton width={240} />} secondary={<Skeleton width={100} />} />
                </ListItem>
              ))
              : sessions.map((session) => (
                <ListItemButton key={session.id} onClick={() => navigate(`/admin/session/${session.sessionId}`)}>
                  <ListItemText primary={`Session ID: ${session.sessionId}`} secondary={`Status: ${session.status}`} />
                </ListItemButton>
              ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default AdminDashboard;
