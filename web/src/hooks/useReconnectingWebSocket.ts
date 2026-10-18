import { useCallback, useEffect, useRef, useState } from 'react';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'failed';

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const MAX_ATTEMPTS = 10;
const JITTER = 0.2;

const backoffDelay = (attempt: number): number => {
  const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return delay * (1 - JITTER + Math.random() * 2 * JITTER);
};

interface Options {
  /** When false, no socket is opened (and any open one is closed). */
  enabled: boolean;
  /** Changing this tears down the current socket and starts afresh. */
  connectionKey: string;
  /** Called on every attempt, so a renewed token is picked up on reconnect. */
  buildUrl: () => string;
  /** Called after every successful open, including reconnects. */
  onOpen?: (socket: WebSocket) => void;
  onMessage: (event: MessageEvent) => void;
}

/**
 * A WebSocket that reconnects with exponential backoff (1s doubling to a 30s cap, ±20% jitter)
 * and gives up after 10 consecutive failed attempts. Closing on unmount never reconnects.
 */
export const useReconnectingWebSocket = ({ enabled, connectionKey, buildUrl, onOpen, onMessage }: Options) => {
  // Hold callbacks in a ref so re-renders (e.g. a silent token renewal) don't tear down the socket
  const callbacksRef = useRef({ buildUrl, onOpen, onMessage });
  callbacksRef.current = { buildUrl, onOpen, onMessage };
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const socket = new WebSocket(callbacksRef.current.buildUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        attempts = 0;
        setStatus('open');
        callbacksRef.current.onOpen?.(socket);
      };
      socket.onmessage = (event) => callbacksRef.current.onMessage(event);
      // An error is always followed by a close, so reconnection is handled there alone
      socket.onclose = () => {
        if (disposed || socketRef.current !== socket) return;
        socketRef.current = null;
        if (attempts >= MAX_ATTEMPTS) {
          setStatus('failed');
          return;
        }
        setStatus('reconnecting');
        timer = setTimeout(connect, backoffDelay(attempts));
        attempts += 1;
      };
    };

    setStatus('connecting');
    connect();

    return () => {
      disposed = true;
      clearTimeout(timer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, connectionKey, retryKey]);

  const send = useCallback((data: unknown): boolean => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(data));
    return true;
  }, []);

  const reconnect = useCallback(() => setRetryKey((k) => k + 1), []);

  return { status, send, reconnect };
};
