import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, Typography, AppBar, Toolbar,
  Drawer, List, ListItem, ListItemText, CircularProgress, Skeleton, Alert,
  FormControl, InputLabel, Select, MenuItem, Stack,
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
  listId: string;
  name: string;
  names: string[];
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  // null until the first successful load, so a refetch keeps showing the data it has
  // rather than flashing skeletons.
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [nameLists, setNameLists] = useState<NameListSummary[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [nameListsLoading, setNameListsLoading] = useState(false);
  const [nameListsError, setNameListsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState('');
  const accessToken = auth.user?.access_token;
  // Read the token through a ref so a silent renewal doesn't trigger a refetch.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const isSignedIn = !!accessToken;
  const orgId = location.state?.orgId as string | undefined;

  const fetchSessions = useCallback(async () => {
    if (!isSignedIn) return;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSessions(await response.json());
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessionsError('Could not load sessions.');
    } finally {
      setSessionsLoading(false);
    }
  }, [isSignedIn]);

  const fetchNameLists = useCallback(async () => {
    if (!orgId || !isSignedIn) return;
    setNameListsLoading(true);
    setNameListsError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/orgs/${orgId}/name-lists`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setNameLists(await response.json());
    } catch (error) {
      console.error('Failed to fetch name lists:', error);
      setNameListsError('Could not load name lists.');
    } finally {
      setNameListsLoading(false);
    }
  }, [isSignedIn, orgId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetchNameLists();
  }, [fetchNameLists]);

  // Fall back to the first list until the admin picks one, or if their pick disappears on refetch.
  const selectedList = nameLists?.find((list) => list.id === selectedListId) ?? nameLists?.[0];
  const noNameLists = !nameListsLoading && !nameListsError && (!orgId || nameLists?.length === 0);

  const createSession = async () => {
    if (!selectedList) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Session' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const session = await res.json();
      const namesRes = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${session.sessionId}/names`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ names: selectedList.names }),
      });
      if (!namesRes.ok) {
        // The session exists but is empty; show it in the list rather than hide it.
        void fetchSessions();
        throw new Error(`HTTP ${namesRes.status}`);
      }
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
          {nameListsLoading && !nameLists
            ? [0, 1, 2].map((i) => (
              <ListItem key={i}>
                <ListItemText primary={<Skeleton width={120} />} secondary={<Skeleton width={60} />} />
              </ListItem>
            ))
            : (nameLists ?? []).map((list) => (
              <ListItemButton
                key={list.listId}
                onClick={() => navigate(`/admin/orgs/${orgId}/name-lists/${list.listId}`)}
              >
                <ListItemText primary={list.name} secondary={`Count: ${list.names.length}`} />
              </ListItemButton>
            ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {!isSignedIn && !auth.isLoading && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={(
              <Button color="inherit" size="small" onClick={() => void auth.signinRedirect()}>
                Sign in
              </Button>
            )}
          >
            You are signed out. Sign in to see your sessions.
          </Alert>
        )}
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }} disabled={creating || !nameLists?.length}>
            <InputLabel id="name-list-select-label">Name list</InputLabel>
            <Select
              labelId="name-list-select-label"
              label="Name list"
              value={selectedList?.id ?? ''}
              onChange={(e) => setSelectedListId(e.target.value)}
            >
              {(nameLists ?? []).map((list) => (
                <MenuItem key={list.id} value={list.id}>{list.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={createSession}
            disabled={creating || !isSignedIn || !selectedList}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Create New Session
          </Button>
        </Stack>
        {isSignedIn && noNameLists && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Create a name list first
          </Typography>
        )}
        {createError && <ErrorAlert message={createError} onRetry={createSession} />}
        {sessionsError ? (
          <ErrorAlert message={sessionsError} onRetry={fetchSessions} />
        ) : (
          <List>
            {(sessionsLoading || (auth.isLoading && !isSignedIn)) && !sessions
              ? [0, 1, 2].map((i) => (
                <ListItem key={i}>
                  <ListItemText primary={<Skeleton width={240} />} secondary={<Skeleton width={100} />} />
                </ListItem>
              ))
              : (sessions ?? []).map((session) => (
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
