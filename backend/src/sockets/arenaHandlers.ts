import { Server, Socket } from 'socket.io';
import Arena from '../models/Arena' // Arena 스키마 import
import ArenaProgress from '../models/ArenaProgress';
import User from '../models/User';
import { terminalProcessCommand } from '../services/terminalEngine';

const dcTimers = new Map<string, NodeJS.Timeout>();
const endTimers = new Map<string, NodeJS.Timeout>();
const MAX_PLAYERS = 8;

const deleteArenaIfEmpty = async (arenaId: string, io: Server) => {
  try {
    const arena = await Arena.findById(arenaId).select('participants');
    if (!arena) return;

    // 'hasLeft: true'가 아닌 참가자가 한 명이라도 있는지 확인
    const hasActiveParticipants = arena.participants.some(p => !p.hasLeft);

    if (!hasActiveParticipants) {
      // 활성 참가자가 없으면 방 삭제
      await Arena.findByIdAndDelete(arenaId);
      // 로비(전역)에 방이 삭제되었음을 알림
      io.emit('arena:room-deleted', arenaId);
      console.log(`[deleteArenaIfEmpty] Arena ${arenaId} deleted due to no active participants.`);
    }
  } catch (e) {
    console.error(`[deleteArenaIfEmpty] error:`, e);
  }
};

/**
 * 지정된 시간에 아레나를 종료하는 스케줄러
 */
const scheduleEnd = (arenaId: string, endTime: Date, io: Server) => {
  const now = new Date();
  const delay = endTime.getTime() - now.getTime();

  // 이미 지난 시간이면 즉시 종료 (혹은 약간의 딜레이)
  if (delay <= 0) {
    console.warn(`[scheduleEnd] Arena ${arenaId} end time is in the past. Ending now.`);
    endArenaProcedure(arenaId, io); // 즉시 종료 함수 호출
    return;
  }

  // 기존 타이머가 있다면 취소
  if (endTimers.has(arenaId)) {
    clearTimeout(endTimers.get(arenaId)!);
  }

  const timer = setTimeout(() => {
    endArenaProcedure(arenaId, io);
    endTimers.delete(arenaId);
  }, delay);

  endTimers.set(arenaId, timer);
};

/**
 * 아레나를 실제로 종료시키는 로직
 */
const endArenaProcedure = async (arenaId: string, io: Server) => {
  try {
    const arena = await Arena.findById(arenaId);
    if (!arena || arena.status === 'ended') return;

    arena.status = 'ended';
    if (!arena.endTime) {
      arena.endTime = new Date(); // 혹시 endTime이 없으면 지금 시간으로
    }
    
    // 1. (신규) ArenaProgress에서 랭킹 계산
    const progressLogs = await ArenaProgress.find({ arena: arenaId })
      .sort({ score: -1, completed: -1, updatedAt: 1 }) 
      .populate('user', '_id username')
      .lean();
      
    // 2. ‼️ (수정) Arena 모델에 랭킹 정보 저장 ‼️
    arena.ranking = progressLogs.map((log, index) => ({
      user: (log.user as any)._id,
      rank: index + 1,
    })) as any; // ⬅️ ‼️ 'as any'를 추가하여 TypeScript 오류를 해결합니다.
    
    // 3. (신규) 승자 결정
    if (progressLogs.length > 0) {
      arena.winner = (progressLogs[0].user as any)._id;
    }

    await arena.save();

    const modeMultiplier: Record<string, number> = {
      'Terminal Race': 1.0,
      'Defense Battle': 1.5,
      'Capture Server': 1.8,
      "Hacker's Deck": 1.3,
      'Exploit Chain': 2.0,
    };

    const baseExp = arena.arenaExp || 50;
    const modeFactor = modeMultiplier[arena.mode] || 1.0;

    const rankMultipliers = [1.0, 0.5, 0.25];
    const defaultRankMultiplier = 0.1;

    for (let i = 0; i < arena.ranking.length; i++) {
      const { user, rank } = arena.ranking[i];
      const rankMultiplier =
        rankMultipliers[i] !== undefined ? rankMultipliers[i] : defaultRankMultiplier;
      const gainedExp = Math.floor(baseExp * modeFactor * rankMultiplier);

      // ✅ 정적 import로 User 조회
      const userDoc = await User.findById(user);
      if (!userDoc) continue;

      userDoc.exp = (userDoc.exp || 0) + gainedExp;
      await userDoc.save();

      // ArenaProgress에도 보상 기록
      await ArenaProgress.updateOne(
        { arena: arenaId, user },
        { $set: { expEarned: gainedExp } }
      );

      console.log(
        `🎁 ${userDoc.username} gained ${gainedExp} EXP (mode=${arena.mode}, rank=${rank})`
      );
    }

    console.log(`[scheduleEnd] Arena ${arenaId} has ended.`);

    // 방에 있는 모든 사람에게 종료 알림
    io.to(arenaId).emit('arena:ended', { 
      arenaId, 
      endTime: arena.endTime,
      ranking: arena.ranking, // 계산된 랭킹 정보
      winner: arena.winner    // 계산된 승자 정보
    });
    
    io.emit('arena:room-deleted', arenaId);

  } catch (e) {
    console.error(`[endArenaProcedure] error:`, e);
  }
};

// --- 메인 소켓 핸들러 등록 ---

export const registerArenaSocketHandlers = (socket: Socket, io: Server) => {

  // 1. 방 참가 (arena:join)
  socket.on('arena:join', async ({ arenaId, userId }) => {
    try {
      const uid = String(userId);
      (socket as any).userId = uid;
      (socket as any).arenaId = String(arenaId);

      // (1) 재연결 시, disconnect 타이머 해제
      const key = `${arenaId}:${userId}`;
      const t = dcTimers.get(key);
      if (t) { clearTimeout(t); dcTimers.delete(key); }

      const room = await Arena.findById(arenaId)
        .select('status maxParticipants participants.user participants.hasLeft host')
        .lean();
      if (!room) return socket.emit('arena:join-failed', { reason: '방이 없습니다.' });

      const isListed = (room.participants || []).some(
        (p: any) => String((p.user && p.user._id) ?? p.user) === uid
      );

      if (room.status === 'started') {
        // (2) 시작 후: 명단에 있는 사람만 재접속 허용
        if (!isListed) {
          return socket.emit('arena:join-failed', { reason: '게임이 이미 시작되었습니다.' });
        }
        socket.join(arenaId);
        // '나감' 상태를 'false'로 복구
        await Arena.updateOne(
          { _id: arenaId, 'participants.user': userId },
          { $set: { 'participants.$.hasLeft': false } }
        );
      } else {
        // (3) 대기 중:
        if (isListed) {
          // 이미 명단에 있으면 소켓만 조인
          socket.join(arenaId);
        } else {
          // (4) 새 참가자 (Race Condition 방지)
          const res = await Arena.updateOne(
            { 
              _id: arenaId, 
              'participants.user': { $ne: userId }, 
              status: 'waiting',
              // $expr를 사용해 참가자 수와 maxParticipants를 비교
              $expr: { $lt: [{ $size: "$participants" }, "$maxParticipants"] }
            },
            { $push: { participants: { user: userId, isReady: false, hasLeft: false } } }
          );
          if (res.modifiedCount === 0) {
            return socket.emit('arena:join-failed', { reason: '입장할 수 없습니다. (정원 초과 또는 이미 입장함)' });
          }
          socket.join(arenaId);
        }
      }

      // (5) 참가 후, 방 전체에 업데이트 방송
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username') // username 필드도 가져옴
        .lean();

      io.to(arenaId).emit('arena:update', {
        arenaId: String(populated?._id || arenaId),
        status: populated?.status || 'waiting',
        host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
        startTime: populated?.startTime || null,
        endTime: populated?.endTime || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user, // { _id, username } 객체
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          progress: pp.progress // 스키마에 있는 progress 객체
        })),
      });

      const user = await User.findById(userId).select('username').lean();
      if (user) {
        io.to(arenaId).emit('arena:notify', {
          type: 'system',
          message: `${user.username}님이 입장했습니다.`
        });
      }

      // (6) 로비(전역)에 방 목록 업데이트 방송
      const summary = await Arena.findById(arenaId)
        .select('name mode status maxParticipants participants.user participants.hasLeft') // mode, hasLeft 추가
        .lean();

      if (summary) {
        // 'hasLeft'가 아닌 사람 수만 계산
        const activeParticipantsCount = (summary.participants || []).filter(p => !p.hasLeft).length;
        
        io.emit('arena:room-updated', {
          _id: String(summary._id),
          name: summary.name,
          mode: summary.mode, // category -> mode
          status: summary.status,
          maxParticipants: summary.maxParticipants,
          // 'activeParticipantsCount' 필드 추가
          activeParticipantsCount: activeParticipantsCount,
        });
      }
    } catch (e) {
      console.error('[arena:join] error:', e);
      socket.emit('arena:join-failed', { reason: '입장 중 오류가 발생했습니다.' });
    }
  });

  // 2. 준비 (arena:ready)
  socket.on('arena:ready', async ({
    arenaId,
    userId,
    ready,
  }: { arenaId: string; userId: string; ready: boolean }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      if (arena.status !== 'waiting') {
        return socket.emit('arena:ready-failed', { reason: '대기 중에만 준비를 변경할 수 있습니다.' });
      }

      const uid = String(userId);
      const p = arena.participants.find(x => String((x.user as any)?._id ?? x.user) === uid && !x.hasLeft);
      if (!p) {
        return socket.emit('arena:ready-failed', { reason: '참가자가 아닙니다.' });
      }

      p.isReady = !!ready;
      await arena.save();

      // 방 전체에 업데이트 방송
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();

      io.to(arenaId).emit('arena:update', {
        arenaId: String(populated?._id || arenaId),
        status: populated?.status || 'waiting',
        host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
        startTime: populated?.startTime || null,
        endTime: populated?.endTime || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          progress: pp.progress
        })),
      });
    } catch (e) {
      console.error('[arena:ready] error:', e);
      socket.emit('arena:ready-failed', { reason: '준비 상태 변경 중 오류가 발생했습니다.' });
    }
  });

  // 3. 시작 (arena:start)
  socket.on('arena:start', async ({ arenaId, userId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      const hostStr = String(arena.host);
      if (hostStr !== String(userId)) {
        return socket.emit('arena:start-failed', { reason: '호스트만 시작할 수 있습니다.' });
      }
      if (arena.status !== 'waiting') {
        return socket.emit('arena:start-failed', { reason: '이미 시작되었거나 종료된 방입니다.' });
      }

      // 'hasLeft: false'인 참가자만 계산
      const activeParticipants = (arena.participants || []).filter(p => !p.hasLeft);

      if (activeParticipants.length < 2) {
        return socket.emit('arena:start-failed', { reason: '최소 2명이 필요합니다.' });
      }

      const others = activeParticipants.filter(p => {
        const uid = String((p.user as any)?._id ?? p.user);
        return uid !== hostStr;
      });
      const everyoneElseReady = others.length > 0 && others.every(p => !!p.isReady);
      if (!everyoneElseReady) {
        return socket.emit('arena:start-failed', { reason: '호스트 제외 전원이 준비되지 않았습니다.' });
      }

      // (1) 아레나 상태 변경
      arena.status = 'started';
      arena.startTime = new Date();
      arena.endTime = new Date(arena.startTime.getTime() + arena.duration * 60000);
      await arena.save();
      
      // (3) 종료 스케줄링
      if (arena.endTime) {
        scheduleEnd(String(arena._id), arena.endTime, io);
      } else {
        console.error('[arena:start] endTime is null, cannot schedule end');
      }

      // (4) 방 전체에 업데이트 방송
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();

      io.to(arenaId).emit('arena:update', {
        arenaId: String(populated?._id || arenaId),
        status: 'started',
        host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
        startTime: populated?.startTime || null,
        endTime: populated?.endTime || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          progress: pp.progress
        })),
      });

      // (5) 방 전체에 시작 이벤트 방송
      io.to(arenaId).emit('arena:start', {
        arenaId,
        startTime: arena.startTime,
        endTime: arena.endTime,
      });
      
    } catch (e) {
      console.error('[arena:start] error:', e);
      socket.emit('arena:start-failed', { reason: '아레나 시작 중 오류 발생' });
    }
  });

  // 4. 나가기 (arena:leave)
  socket.on('arena:leave', async ({ arenaId, userId }) => {
    try {
      const user = await User.findById(userId).select('username').lean();
      if (user) {
        io.to(arenaId).emit('arena:notify', {
          type: 'system',
          message: `${user.username}님이 퇴장했습니다.`
        });
      }

      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      const uid = String(userId);
      const wasHost = String(arena.host) === uid;

      if (arena.status === 'waiting') {
        // (1) 대기중: 명단에서 완전 제거
        await Arena.updateOne(
          { _id: arenaId },
          { $pull: { participants: { user: userId } } }
        );

        // (2) 호스트 승계 로직
        if (wasHost) {
          const after = await Arena.findById(arenaId);
          if (after) {
            // 'hasLeft: false'인 다음 사람을 호스트로
            const nextParticipant = after.participants.find(p => !p.hasLeft);
            const nextHost = nextParticipant?.user;
            
            if (nextHost) { 
              after.host = (nextHost as any)?._id ?? nextHost; 
              await after.save(); 
            }
          }
        }
      } else {
        // (3) 시작/종료 후: 명단 유지, 'hasLeft: true'로 설정
        await Arena.updateOne(
          { _id: arenaId, 'participants.user': userId },
          { $set: { 'participants.$.hasLeft': true } }
        );
      }

      socket.leave(arenaId);

      // (4) 방 내부 업데이트 (populate)
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();

      if (populated) {
        io.to(arenaId).emit('arena:update', {
          arenaId: String(populated._id || arenaId),
          status: populated.status || 'waiting',
          host: String((populated.host as any)?._id ?? populated.host ?? ''),
          startTime: populated.startTime || null,
          endTime: populated.endTime || null,
          participants: (populated.participants || []).map((pp: any) => ({
            user: pp.user,
            isReady: !!pp.isReady,
            hasLeft: !!pp.hasLeft,
            progress: pp.progress
          })),
        });
      }

      // (5) 로비(전역) 업데이트 (lean)
      const room = await Arena.findById(arenaId)
        .select('name mode status maxParticipants participants.user participants.hasLeft')
        .lean();

      if (room) {
        const activeParticipantsCount = (room.participants || []).filter(p => !p.hasLeft).length;

        io.emit('arena:room-updated', {
          _id: String(room._id),
          name: room.name,
          mode: room.mode, // category -> mode
          status: room.status,
          maxParticipants: room.maxParticipants,
          activeParticipantsCount: activeParticipantsCount,
        });
      }

      // (6) 방이 비었는지 확인 (대기/시작 상태 모두)
      if (arena.status === 'waiting' || arena.status === 'started') {
        await deleteArenaIfEmpty(arenaId, io);
      }
    } catch (e) {
      console.error('[arena:leave] error:', e);
    }
  });

  // 5. 연결 끊김 (disconnect)
  socket.on('disconnect', () => {
    const arenaId = (socket as any).arenaId;
    const userId  = (socket as any).userId;
    if (!arenaId || !userId) return;

    const key = `${arenaId}:${userId}`;
    if (dcTimers.has(key)) return; // 중복 타이머 방지

    // 3초의 재연결 유예 시간
    const timer = setTimeout(async () => {
      dcTimers.delete(key);
      try {
        const user = await User.findById(userId).select('username').lean();
        if (user) {
          io.to(arenaId).emit('arena:notify', {
            type: 'system',
            message: `${user.username}님이 연결이 끊겨 퇴장했습니다.`
          });
        }
        const arena = await Arena.findById(arenaId);
        if (!arena) return;

        // 'arena:leave'와 동일한 로직 수행
        
        if (arena.status === 'waiting') {
          // (1) 대기중: 완전 제거 + 호스트 승계
          await Arena.updateOne(
            { _id: arenaId },
            { $pull: { participants: { user: userId } } }
          );
          
          if (String(arena.host) === String(userId)) {
            const after = await Arena.findById(arenaId);
            if (after) {
              const nextParticipant = after.participants.find(p => !p.hasLeft);
              const nextHost = nextParticipant?.user;
              if (nextHost) { 
                after.host = (nextHost as any)?._id ?? nextHost; 
                await after.save(); 
              }
            }
          }
        } else {
          // (2) 시작/종료: 'hasLeft: true'
          await Arena.updateOne(
            { _id: arenaId, 'participants.user': userId },
            { $set: { 'participants.$.hasLeft': true } }
          );
        }

        // (3) 방 내부 업데이트 (populate)
        const populated = await Arena.findById(arenaId)
          .populate('participants.user', '_id username').lean();

        if (populated) {
          io.to(arenaId).emit('arena:update', {
            arenaId: String(populated._id || arenaId),
            status: populated.status || 'waiting',
            host: String((populated.host as any)?._id ?? populated.host ?? ''),
            startTime: populated.startTime || null,
            endTime: populated.endTime || null,
            participants: (populated.participants || []).map((pp: any) => ({
              user: pp.user,
              isReady: !!pp.isReady,
              hasLeft: !!pp.hasLeft,
              progress: pp.progress
            })),
          });
        }

        // (4) 로비(전역) 업데이트 (lean)
        const room = await Arena.findById(arenaId)
          .select('name mode status maxParticipants participants.user participants.hasLeft').lean();

        if (room) {
          const activeParticipantsCount = (room.participants || []).filter(p => !p.hasLeft).length;

          io.emit('arena:room-updated', {
            _id: String(room._id),
            name: room.name,
            mode: room.mode, 
            status: room.status,
            maxParticipants: room.maxParticipants,
            activeParticipantsCount: activeParticipantsCount,
          });
        }

        // (5) 방이 비었는지 확인 (대기/시작 상태 모두)
        if (arena.status === 'waiting' || arena.status === 'started') {
          await deleteArenaIfEmpty(arenaId, io);
        }
      } catch (e) {
        console.error('[disconnect grace] error:', e);
      }
    }, 3000); // 3초 유예

    dcTimers.set(key, timer);
  });

  // 6. 상태 동기화 (arena:sync)
  socket.on('arena:sync', async ({ arenaId }) => {
    try {
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();
      if (!populated) return;

      // 요청한 소켓(본인)에게만 최신 상태 전송
      socket.emit('arena:update', {
        arenaId: String(populated._id),
        status: populated.status || 'waiting',
        host: String((populated.host as any)?._id ?? populated.host ?? ''),
        startTime: populated.startTime || null,
        endTime: populated.endTime || null,
        participants: (populated.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          progress: pp.progress
        })),
      });
    } catch (e) {
      console.error('[arena:sync] error:', e);
    }
  });

  socket.on('arena:chat', async ({ message }: { message: string }) => {
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;
    if (!arenaId || !userId || !message || message.trim().length === 0) return;

    try {
      // (1) 메시지를 보낸 유저 정보 가져오기
      const user = await User.findById(userId).select('username').lean();
      if (!user) return;

      // (2) 해당 방(arenaId)에만 채팅 메시지 전송
      io.to(arenaId).emit('arena:chatMessage', {
        type: 'chat',
        senderId: userId,
        senderName: user.username,
        message: message.trim(), // 앞뒤 공백 제거
        timestamp: new Date(),
      });

    } catch (e) {
      console.error('[arena:chat] error:', e);
    }
  });

  // 8. [추가] 강퇴 (arena:kick)
  socket.on('arena:kick', async ({ kickedUserId }: { kickedUserId: string }) => {
    const arenaId = (socket as any).arenaId;
    const hostId = (socket as any).userId;
    if (!arenaId || !hostId || !kickedUserId) return;
    
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      // (1) 보안: 요청자가 정말 호스트인지 확인
      if (String(arena.host) !== hostId) {
        return socket.emit('arena:kick-failed', { reason: '호스트만 강퇴할 수 있습니다.' });
      }
      
      // (2) 스스로 강퇴 불가
      if (hostId === kickedUserId) return;
      
      // (3) 강퇴당할 유저 정보 (알림용)
      const kickedUser = await User.findById(kickedUserId).select('username').lean();

      // (4) 강퇴 로직 ('arena:leave'와 유사하게 처리)
      if (arena.status === 'waiting') {
        await Arena.updateOne(
          { _id: arenaId },
          { $pull: { participants: { user: kickedUserId } } }
        );
      } else {
        // 게임 중에는 강퇴 비활성화 또는 hasLeft: true 처리 (현재는 waiting만 가정)
        return socket.emit('arena:kick-failed', { reason: '게임 중에는 강퇴할 수 없습니다.' });
      }
      
      // (5) 방 전체에 업데이트 방송 (populate)
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username').lean();
        
      if (populated) {
        io.to(arenaId).emit('arena:update', {
          arenaId: String(populated._id || arenaId),
          status: populated.status || 'waiting',
          host: String((populated.host as any)?._id ?? populated.host ?? ''),
          startTime: populated.startTime || null,
          endTime: populated.endTime || null,
          participants: (populated.participants || []).map((pp: any) => ({
            user: pp.user,
            isReady: !!pp.isReady,
            hasLeft: !!pp.hasLeft,
            progress: pp.progress
          })),
        });
      }
      
      // (6) 로비(전역) 업데이트 (lean)
      const room = await Arena.findById(arenaId)
        .select('name mode status maxParticipants participants.user participants.hasLeft').lean();
      
      if (room) {
        const activeParticipantsCount = (room.participants || []).filter(p => !p.hasLeft).length;
        io.emit('arena:room-updated', {
          _id: String(room._id),
          name: room.name,
          mode: room.mode,
          status: room.status,
          maxParticipants: room.maxParticipants,
          activeParticipantsCount: activeParticipantsCount,
        });
      }
      
      // (7) 강퇴당한 유저에게 알리고 방에서 내보내기
      for (const [id, s] of io.of("/").sockets) {
        if ((s as any).userId === kickedUserId && (s as any).arenaId === arenaId) {
          s.emit('arena:kicked', { reason: '방장에 의해 강퇴당했습니다.' });
          s.leave(arenaId);
          break;
        }
      }
      
      // (8) 강퇴 알림
      if (kickedUser) {
        io.to(arenaId).emit('arena:notify', {
          type: 'system',
          message: `${kickedUser.username}님이 방장에 의해 강퇴당했습니다.`
        });
      }

    } catch (e) {
      console.error('[arena:kick] error:', e);
    }
  });
  
  // 9. [추가] 설정 변경 (arena:settingsChange)
  socket.on('arena:settingsChange', async ({ newSettings }: { newSettings: { name?: string, maxParticipants?: number } }) => {
    const arenaId = (socket as any).arenaId;
    const hostId = (socket as any).userId;
    if (!arenaId || !hostId) return;
    
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      // (1) 보안: 호스트인지, 'waiting' 상태인지 확인
      if (String(arena.host) !== hostId) return;
      if (arena.status !== 'waiting') return;

      // (2) 설정 값 업데이트
      let changed = false;
      
      // 방 제목 변경
      if (newSettings.name && newSettings.name.trim().length > 0 && newSettings.name.length <= 30) {
        arena.name = newSettings.name.trim();
        changed = true;
      }
      
      // 최대 인원 변경 (현재 인원보다 적게 설정 불가)
      const activeParticipantsCount = arena.participants.filter(p => !p.hasLeft).length;
      if (newSettings.maxParticipants && newSettings.maxParticipants >= activeParticipantsCount && newSettings.maxParticipants <= MAX_PLAYERS) { // MAX_PLAYERS는 상수로 정의 필요
        arena.maxParticipants = newSettings.maxParticipants;
        changed = true;
      }
      
      if (!changed) return; // 변경 사항 없음
      
      await arena.save();

      // (3) 방 전체에 업데이트 방송 (populate)
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username').lean();
      if (populated) {
        io.to(arenaId).emit('arena:update', {
          arenaId: String(populated._id || arenaId),
          status: populated.status || 'waiting',
          host: String((populated.host as any)?._id ?? populated.host ?? ''),
          startTime: populated.startTime || null,
          endTime: populated.endTime || null,
          participants: (populated.participants || []).map((pp: any) => ({
            user: pp.user,
            isReady: !!pp.isReady,
            hasLeft: !!pp.hasLeft,
            progress: pp.progress
          })),
        });
      }
      
      // (4) 로비(전역) 업데이트 (lean)
      const room = await Arena.findById(arenaId)
        .select('name mode status maxParticipants participants.user participants.hasLeft').lean();
      if (room) {
        const activeParticipantsCount = (room.participants || []).filter(p => !p.hasLeft).length;
        io.emit('arena:room-updated', {
          _id: String(room._id),
          name: room.name,
          mode: room.mode,
          status: room.status,
          maxParticipants: room.maxParticipants,
          activeParticipantsCount: activeParticipantsCount,
        });
      }
      
    } catch (e) {
      console.error('[arena:settingsChange] error:', e);
    }
  });

  
  // 7. ‼️ 모드 1: Terminal Race 핸들러 (ArenaProgress 사용 버전) ‼️
  socket.on('terminal:execute', async ({ 
    command 
  }: { command: string }) => {
    
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;
    if (!arenaId || !userId) return; // 기본 가드

    try {
      // 1. (수정) 아레나 정보는 간단히 확인
      // (lean()을 써서 가볍게 가져와도 됩니다)
      const arena = await Arena.findById(arenaId).select('mode status winner');
      if (!arena) throw new Error('Arena not found');
      if (arena.mode !== 'Terminal Race') {
        throw new Error('Invalid action for this Arena mode');
      }
      if (arena.status !== 'started') {
        throw new Error('Arena is not started');
      }

      // 2. ‼️ '게임 엔진' 호출 (동일) ‼️
      // (이 엔진은 ArenaProgress에서 스테이지를 읽어옵니다)
      console.log(`\n[Terminal Race] User ${userId} executed: "${command}"`);
      
      // 🔍 업데이트 전 현재 상태 확인
      const beforeProgress = await ArenaProgress.findOne({ arena: arenaId, user: userId });
      console.log('📊 Before Progress:', beforeProgress ? {
        stage: beforeProgress.stage,
        score: beforeProgress.score
      } : 'No progress doc yet');
      
      const result = await terminalProcessCommand(arenaId, userId, command);
      console.log('🎮 Command Result:', {
        message: result.message,
        progressDelta: result.progressDelta,
        advanceStage: result.advanceStage,
        flagFound: result.flagFound
      });

      const incUpdate: any = { score: result.progressDelta || 0 };
      if (result.advanceStage) {
        incUpdate.stage = 1; // ‼️ 스테이지 1 증가
      }
      
      const updatePayload: any = {
        $inc: incUpdate, // 점수 누적 (+ 스테이지 증가)
        $push: { 
          flags: { // ‼️ 플래그 제출 시도 로그
            correct: result.flagFound || false,
            submittedAt: new Date()
          }
        }
      };
      
      if (result.flagFound) {
        updatePayload.$set = { completed: true }; // ‼️ 완료 처리
      }

      console.log('📝 Update Payload:', JSON.stringify(updatePayload, null, 2));

      // ‼️ upsert: true -> 이 유저의 로그가 없으면 새로 생성, 있으면 업데이트
      const progressDoc = await ArenaProgress.findOneAndUpdate(
        { arena: arenaId, user: userId },
        updatePayload,
        { 
          upsert: true, 
          new: true, 
          setDefaultsOnInsert: true
        }
      );
      
      console.log('✅ After Progress:', {
        stage: progressDoc.stage,
        score: progressDoc.score
      });
      console.log('---\n');
      // ----------------------------------------
      
      // 4. 클라이언트에 결과 전송 (수정)
      io.to(arenaId).emit('terminal:result', {
        userId,
        command,
        message: result.message,
        progressDelta: result.progressDelta,
        flagFound: result.flagFound,
      });
      io.to(arenaId).emit('participant:update', {
        userId,
        progress: progressDoc // ‼️ 방금 업데이트된 ArenaProgress 문서를 보냄
      });
      
      // 5. ‼️ 게임 종료 처리 (수정) ‼️
      // (승자가 아직 없고, 플래그를 찾았을 경우)
      if (result.flagFound && !arena.winner) {
        // ‼️ Arena 모델 자체에도 승자(winner)는 기록해야 합니다.
        arena.winner = userId;
        arena.firstSolvedAt = new Date();
        await arena.save();
        
        // ‼️ 즉시 게임 종료
        endArenaProcedure(arenaId, io);
      }

    } catch (e) {
      console.error('[terminal:execute] error:', e);
      socket.emit('arena:action-failed', { 
        reason: (e as Error).message || 'An error occurred' 
      });
    }
  });

  socket.on('terminal:get-progress', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    if (!arenaId || !userId) return;

    try {
      // ArenaProgress에서 현재 유저의 진행 상황 조회
      const progressDoc = await ArenaProgress.findOne({ 
        arena: arenaId, 
        user: userId 
      }).lean();

      // 진행 상황이 없으면 초기 상태 반환
      if (!progressDoc) {
        socket.emit('terminal:progress-data', {
          stage: 0,
          score: 0,
          completed: false
        });
        return;
      }

      // 진행 상황 반환
      socket.emit('terminal:progress-data', {
        stage: progressDoc.stage || 0,
        score: progressDoc.score || 0,
        completed: progressDoc.completed || false
      });

    } catch (e) {
      console.error('[terminal:get-progress] error:', e);
      // 에러 시 초기 상태 반환
      socket.emit('terminal:progress-data', {
        stage: 0,
        score: 0,
        completed: false
      });
    }
  });
  // 8. ‼️ 모드 4: Hacker's Deck 핸들러 (문서 21p 기반) ‼️
  // (Phase 1  우선순위이므로 미리 틀을 만듭니다)
  socket.on('deck:play-card', async ({
    cardId
  }: { cardId: string }) => {
    
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;
    if (!arenaId || !userId) return;

    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) throw new Error('Arena not found');

      // ‼️ 모드 가드 ‼️
      if (arena.mode !== "Hacker's Deck") { 
        throw new Error('Invalid action for this Arena mode');
      }
      if (arena.status !== 'started') {
        throw new Error('Arena is not started');
      }
    } catch (e) {
      console.error('[deck:play-card] error:', e);
      socket.emit('arena:action-failed', { 
        reason: (e as Error).message || 'An error occurred' 
      });
    }
  });
};