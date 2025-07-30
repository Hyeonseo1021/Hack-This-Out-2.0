// ArenaPage.tsx
import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Main from '../../components/main/Main';

const socket: Socket = io('http://localhost:3000', {
  transports: ['websocket'],
  withCredentials: true
});

const TEST_USER_ID = '64ccf91a730e3f1e0aa13333';
const TEST_ARENA_ID = '64cd9999999999abcdef1234'; // 실제 아레나 ID로 바꿔야 함

const ArenaPage: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    socket.on('connect', () => {
      setMessages(prev => [...prev, `✅ Connected: ${socket.id}`]);
    });

    socket.on('arena:update-participants', (data) => {
      setMessages(prev => [...prev, `🟢 Participants updated: ${JSON.stringify(data)}`]);
    });

    socket.on('arena:start', () => {
      setMessages(prev => [...prev, '🚀 Arena started!']);
    });

    return () => {
      socket.off('connect');
      socket.off('arena:update-participants');
      socket.off('arena:start');
    };
  }, []);

  const handleJoin = () => {
    socket.emit('arena:join', {
      arenaId: TEST_ARENA_ID,
      userId: TEST_USER_ID
    });
    setMessages(prev => [...prev, '📨 Sent: arena:join']);
  };

  const handleReady = () => {
    socket.emit('arena:ready', {
      arenaId: TEST_ARENA_ID,
      userId: TEST_USER_ID,
      isReady: true
    });
    setMessages(prev => [...prev, '📨 Sent: arena:ready']);
  };

  const handleStart = () => {
    socket.emit('arena:start', {
      arenaId: TEST_ARENA_ID
    });
    setMessages(prev => [...prev, '📨 Sent: arena:start']);
  };

  return (
    <Main>
      <div style={{ padding: '2rem' }}>
        <h2>🧪 Arena Socket 테스트</h2>
        <button onClick={handleJoin}>Join Arena</button>
        <button onClick={handleReady}>Ready Up</button>
        <button onClick={handleStart}>Start Arena</button>

        <div style={{ marginTop: '1rem' }}>
          <h3>📡 로그:</h3>
          <ul>
            {messages.map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      </div>
    </Main>
  );
};

export default ArenaPage;
