import { Server, Socket } from 'socket.io';
import Arena from '../models/Arena' // Arena 스키마 import
import ArenaProgress from '../models/ArenaProgress';
import User from '../models/User';
import { endArenaProcedure }  from './utils/endArenaProcedure';
import { terminalProcessCommand } from '../services/terminalRace/terminalEngine';
import { registerTerminalRaceHandlers, initializeTerminalRace } from './modes/terminalRaceHandler';
import { initializeScannerRace } from './modes/VulnerablilityScannerHandler';
import { initializeForensicsRush } from './modes/ForensicsRushHandler';
import { registerSocialEngineeringHandlers } from './modes/SocialEngineeringHandler';

const dcTimers = new Map<string, NodeJS.Timeout>();
const endTimers = new Map<string, NodeJS.Timeout>();
const MAX_PLAYERS = 8;

export const cancelScheduledEnd = (arenaId: string) => {
  if (endTimers.has(arenaId)) {
    clearTimeout(endTimers.get(arenaId)!);
    endTimers.delete(arenaId);
    console.log(`🧹 Cancelled scheduled end for arena ${arenaId}`);
  }
};

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

// --- 메인 소켓 핸들러 등록 ---

export const registerArenaSocketHandlers = (socket: Socket, io: Server) => {

  // ✅ 모드별 핸들러 등록
  registerTerminalRaceHandlers(io, socket);
  registerSocialEngineeringHandlers(io, socket);

  // 1. 방 참가 (arena:join) - ✅ 최초 연결 시에만 userId 설정
  socket.on('arena:join', async ({ arenaId, userId }) => {
    try {
      // ✅ 보안: 이미 userId가 설정되어 있으면 변경 불가 (스푸핑 방지)
      const existingUserId = (socket as any).userId;
      if (existingUserId && existingUserId !== String(userId)) {
        return socket.emit('arena:join-failed', { reason: '잘못된 요청입니다.' });
      }

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
        mode: populated?.mode,
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
          message: {
            ko: `${user.username}님이 입장했습니다.`,
            en: `${user.username} has joined.`
          }
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

  // 2. 준비 (arena:ready) - ✅ userId는 소켓에서 가져옴
  socket.on('arena:ready', async ({
    arenaId,
    ready,
  }: { arenaId: string; ready: boolean }) => {
    // ✅ 보안: userId는 소켓에서 가져옴 (스푸핑 방지)
    const uid = (socket as any).userId;
    const socketArenaId = (socket as any).arenaId;

    // ✅ 보안: arenaId 검증
    if (!uid || arenaId !== socketArenaId) {
      return socket.emit('arena:ready-failed', { reason: '잘못된 요청입니다.' });
    }

    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      if (arena.status !== 'waiting') {
        return socket.emit('arena:ready-failed', { reason: '대기 중에만 준비를 변경할 수 있습니다.' });
      }
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
        mode: populated?.mode,
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

  // 3. 시작 (arena:start) - ✅ userId는 소켓에서 가져옴
  socket.on('arena:start', async ({ arenaId }: { arenaId: string }) => {
    // ✅ 보안: userId는 소켓에서 가져옴 (스푸핑 방지)
    const userId = (socket as any).userId;
    const socketArenaId = (socket as any).arenaId;

    // ✅ 보안: arenaId 검증
    if (!userId || arenaId !== socketArenaId) {
      return socket.emit('arena:start-failed', { reason: '잘못된 요청입니다.' });
    }

    try {
      const arena = await Arena.findById(arenaId).populate('scenarioId');
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
      arena.endTime = new Date(arena.startTime.getTime() + arena.timeLimit * 1000);

      // ✅ 모든 참가자의 personalEndTime 초기화 (전체 endTime과 동일하게 시작)
      arena.participants.forEach((p: any) => {
        if (!p.hasLeft) {
          p.personalEndTime = arena.endTime;
        }
      });

      await arena.save();

      // (2) 모드별 초기화
      const arenaIdStr = String(arena._id);
      const mode = arena.mode;

      console.log(`🎮 Initializing game mode: ${mode} for arena ${arenaIdStr}`);

      if (mode === 'VULNERABILITY_SCANNER_RACE') {
        // HTML이 이미 생성되어 있는지 확인
        const populatedArena = await Arena.findById(arenaId).populate('scenarioId');
        const scenario = populatedArena?.scenarioId as any;
        const hasPreGeneratedHTML = scenario?.data?.generatedHTML && scenario.data.generatedHTML.length > 0;

        if (!hasPreGeneratedHTML && scenario?.data?.mode === 'SIMULATED') {
          // HTML 생성이 필요한 경우만 로딩 알림
          console.log('🔄 [arena:start] HTML generation required, showing loading screen');
          io.to(arenaId).emit('arena:initializing', {
            message: 'HTML 취약점 환경을 생성 중입니다...'
          });
          await initializeScannerRace(arenaIdStr);
          io.to(arenaId).emit('arena:initialized');
        } else {
          // HTML이 이미 존재하거나 REAL 모드인 경우
          console.log('✅ [arena:start] Using existing HTML or REAL mode, skipping loading screen');
          await initializeScannerRace(arenaIdStr);
        }
      } else if (mode === 'FORENSICS_RUSH') {
        await initializeForensicsRush(arenaIdStr);
      } else if (mode === 'TERMINAL_HACKING_RACE') {
        await initializeTerminalRace(arenaIdStr);
      }

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
        mode: populated?.mode,
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

  // 4. 나가기 (arena:leave) - ✅ userId는 소켓에서 가져옴
  socket.on('arena:leave', async ({ arenaId }: { arenaId: string }) => {
    // ✅ 보안: userId는 소켓에서 가져옴 (스푸핑 방지)
    const userId = (socket as any).userId;
    const socketArenaId = (socket as any).arenaId;

    // ✅ 보안: arenaId 검증
    if (!userId || arenaId !== socketArenaId) {
      return;
    }

    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      // (0) 사용자가 실제로 이 방에 있는지 확인
      const uid = String(userId);
      const participant = arena.participants.find(
        (p: any) => String((p.user as any)?._id ?? p.user) === uid
      );

      if (!participant) {
        console.warn(`[arena:leave] User ${uid} not found in arena ${arenaId}`);
        return;
      }

      const user = await User.findById(userId).select('username').lean();
      if (user) {
        io.to(arenaId).emit('arena:notify', {
          type: 'system',
          message: {
            ko: `${user.username}님이 퇴장했습니다.`,
            en: `${user.username} has left.`
          }
        });
      }

      const wasHost = String(arena.host) === uid;

      // (1.5) 소켓을 방에서 제거
      socket.leave(arenaId);
      console.log(`[arena:leave] Socket left room ${arenaId} for user ${uid}`);

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
              
              io.to(arenaId).emit('arena:notify', {
                type: 'system',
                message: {
                  ko: '호스트가 변경되었습니다.',
                  en: 'The host has changed.'
                }
              });
            } else {
              // 남은 사람이 없으면 방 자동 삭제
              await Arena.findByIdAndDelete(arenaId);
              io.emit('arena:room-deleted', arenaId);
              console.log(`[arena:leave] Arena ${arenaId} deleted as no participants remain.`);
              return; // 방 삭제 후 더 이상 처리 불필요
            }
          }
        }
      } else {
        // (3) 시작 후: hasLeft=true (ArenaProgress는 유지)
        await Arena.updateOne(
          { _id: arenaId, 'participants.user': userId },
          { $set: { 'participants.$.hasLeft': true } }
        );
      }

      // (4) 방 전체에 업데이트 방송
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();

      if (populated) {
        io.to(arenaId).emit('arena:update', {
          arenaId: String(populated._id),
          mode: populated?.mode,
          status: populated.status,
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

      // (5) 로비(전역) 업데이트
      const summary = await Arena.findById(arenaId)
        .select('name mode status maxParticipants participants.user participants.hasLeft')
        .lean();
      if (summary) {
        const activeParticipantsCount = (summary.participants || []).filter(p => !p.hasLeft).length;
        io.emit('arena:room-updated', {
          _id: String(summary._id),
          name: summary.name,
          mode: summary.mode,
          status: summary.status,
          maxParticipants: summary.maxParticipants,
          activeParticipantsCount: activeParticipantsCount,
        });
      }

    } catch (e) {
      console.error('[arena:leave] error:', e);
    }
  });

  // 5. 종료 (arena:end) - ✅ 호스트만 강제 종료 가능
  socket.on('arena:end', async ({ arenaId }) => {
    const userId = (socket as any).userId;

    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      // ✅ 보안: 호스트만 강제 종료 가능
      if (String(arena.host) !== userId) {
        return socket.emit('arena:end-failed', { reason: '호스트만 게임을 종료할 수 있습니다.' });
      }

      await endArenaProcedure(arenaId, io);
    } catch (e) {
      console.error('[arena:end] error:', e);
    }
  });

  // 5-1. disconnect (연결 해제 시 유예 시간 부여)
  socket.on('disconnect', () => {
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    if (!arenaId || !userId) return;

    const key = `${arenaId}:${userId}`;
    const timer = setTimeout(async () => {
      try {
        const arena = await Arena.findById(arenaId);
        if (!arena) return;

        const participant = arena.participants.find(
          (p: any) => String((p.user as any)?._id ?? p.user) === userId
        );

        if (!participant) return;

        // (1) 대기 중
        if (arena.status === 'waiting') {
          const wasHost = String(arena.host) === userId;
          
          await Arena.updateOne(
            { _id: arenaId },
            { $pull: { participants: { user: userId } } }
          );

          if (wasHost) {
            const after = await Arena.findById(arenaId);
            if (after && after.participants.length > 0) {
              const next = after.participants.find(p => !p.hasLeft)?.user;
              if (next) {
                after.host = (next as any)?._id ?? next;
                await after.save();
              }
            }
          }

          const user = await User.findById(userId).select('username').lean();
          if (user) {
            io.to(arenaId).emit('arena:notify', {
              type: 'system',
              message: {
                ko: `${user.username}님이 연결이 끊어졌습니다.`,
                en: `${user.username} has disconnected.`
              }
            });
          }

          const populated = await Arena.findById(arenaId)
            .populate('participants.user', '_id username')
            .lean();
          if (populated) {
            io.to(arenaId).emit('arena:update', {
              arenaId: String(populated._id || arenaId),
              mode: populated?.mode,
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
        }

        // (2) 시작 후
        else if (arena.status === 'started') {
          await Arena.updateOne(
            { _id: arenaId, 'participants.user': userId },
            { $set: { 'participants.$.hasLeft': true } }
          );

          const user = await User.findById(userId).select('username').lean();
          if (user) {
            io.to(arenaId).emit('arena:notify', {
              type: 'system',
              message: {
                ko: `${user.username}님이 연결이 끊어졌습니다.`,
                en: `${user.username} has disconnected.`
              }
            });
          }

          const populated = await Arena.findById(arenaId)
            .populate('participants.user', '_id username')
            .lean();
          if (populated) {
            io.to(arenaId).emit('arena:update', {
              arenaId: String(populated._id || arenaId),
              mode: populated?.mode,
              status: populated.status || 'started',
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
        mode: populated?.mode,
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
          mode: populated?.mode,
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
          message: {
            ko: `${kickedUser.username}님이 방장에 의해 강퇴당했습니다.`,
            en: `${kickedUser.username} has been kicked by the host.`
          }
        });
      }

    } catch (e) {
      console.error('[arena:kick] error:', e);
    }
  });
  
  // 9. [추가] 아이템 사용 (arena:use-item) - ✅ 보안 강화
  socket.on('arena:use-item', async ({ arenaId, itemType, value, duration }: { arenaId: string, itemType: string, value: number, duration?: number }) => {
    // ✅ 보안: userId는 반드시 소켓에서 가져옴 (스푸핑 방지)
    const userId = (socket as any).userId;
    const socketArenaId = (socket as any).arenaId;

    // ✅ 보안: arenaId 검증 (다른 방에 영향 주는 것 방지)
    if (arenaId !== socketArenaId) {
      return socket.emit('arena:use-item-failed', { reason: '잘못된 요청입니다.' });
    }

    // ✅ 보안: 아이템 값 범위 제한 (악용 방지)
    const ITEM_LIMITS = {
      time_extension: { maxValue: 300, maxDuration: 0 },      // 최대 5분 연장
      time_freeze: { maxValue: 60, maxDuration: 0 },          // 최대 1분 정지
      score_boost: { maxValue: 50, maxDuration: 300 },        // 최대 50% 부스트, 5분
      invincible: { maxValue: 120, maxDuration: 0 }           // 최대 2분 무적
    };

    const limits = ITEM_LIMITS[itemType as keyof typeof ITEM_LIMITS];
    if (!limits) {
      return socket.emit('arena:use-item-failed', { reason: '알 수 없는 아이템입니다.' });
    }

    // ✅ 보안: 값 범위 검증
    if (value <= 0 || value > limits.maxValue) {
      return socket.emit('arena:use-item-failed', { reason: '잘못된 아이템 값입니다.' });
    }

    if (duration !== undefined && limits.maxDuration > 0 && duration > limits.maxDuration) {
      return socket.emit('arena:use-item-failed', { reason: '잘못된 지속 시간입니다.' });
    }

    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      // 게임이 시작된 상태에서만 아이템 사용 가능
      if (arena.status !== 'started') {
        return socket.emit('arena:use-item-failed', { reason: '게임 중에만 아이템을 사용할 수 있습니다.' });
      }

      // 참가자 확인
      const participant = arena.participants.find(
        (p: any) => String((p.user as any)?._id ?? p.user) === userId && !p.hasLeft
      );
      if (!participant) {
        return socket.emit('arena:use-item-failed', { reason: '참가자가 아닙니다.' });
      }

      // 아이템 타입별 처리
      if ((itemType === 'time_extension' || itemType === 'time_freeze') && value > 0) {
        // ✅ 유예시간 중인지 확인 (winner가 있고 firstSolvedAt이 설정된 상태)
        const isGracePeriod = arena.winner && arena.firstSolvedAt;

        // 사용자 이름 가져오기
        const user = await User.findById(userId).select('username').lean();
        const username = user?.username || 'Someone';

        if (isGracePeriod) {
          // ✅ 유예시간 중에는 시간 연장 불가
          return socket.emit('arena:use-item-failed', {
            reason: '유예시간 중에는 시간 연장권을 사용할 수 없습니다.'
          });
        }

        // ✅ 평상시 - 개인 personalEndTime만 연장 (본인만 영향)
        const participantIndex = arena.participants.findIndex(
          (p: any) => String((p.user as any)?._id ?? p.user) === userId
        );

        if (participantIndex !== -1) {
          const currentPersonalEndTime = arena.participants[participantIndex].personalEndTime || arena.endTime;
          const newPersonalEndTime = new Date(currentPersonalEndTime.getTime() + value * 1000);
          arena.participants[participantIndex].personalEndTime = newPersonalEndTime;
          await arena.save();

          // 해당 유저에게만 개인 타이머 업데이트 알림
          socket.emit('arena:personal-time-extended', {
            userId,
            personalEndTime: newPersonalEndTime.toISOString(),
            value
          });

          // 전체에게 아이템 사용 알림
          io.to(arenaId).emit('arena:item-used', {
            userId,
            username,
            itemType,
            value,
            message: {
              ko: `${username}님이 시간 연장권을 사용했습니다! (+${value}초)`,
              en: `${username} used a Time Extension! (+${value} sec)`
            }
          });
        }
      } else if (itemType === 'score_boost' && value > 0) {
        // Score boost buff 추가 (value는 % 값, duration은 초 단위)
        const startedAt = new Date();
        const durationMs = (duration || 120) * 1000; // 기본값 120초
        const expiresAt = new Date(startedAt.getTime() + durationMs);

        const participantIndex = arena.participants.findIndex(
          (p: any) => String((p.user as any)?._id ?? p.user) === userId
        );

        if (participantIndex !== -1) {
          if (!arena.participants[participantIndex].activeBuffs) {
            arena.participants[participantIndex].activeBuffs = [];
          }

          // 기존 score_boost 제거 후 새로 추가
          arena.participants[participantIndex].activeBuffs = arena.participants[participantIndex].activeBuffs.filter(
            (b: any) => b.type !== 'score_boost'
          );

          arena.participants[participantIndex].activeBuffs.push({
            type: 'score_boost',
            value,
            startedAt,
            expiresAt
          } as any);

          await arena.save();

          const user = await User.findById(userId).select('username').lean();
          const username = user?.username || 'Someone';

          io.to(arenaId).emit('arena:item-used', {
            userId,
            username,
            itemType,
            value,
            message: {
              ko: `${username}님이 점수 부스트를 사용했습니다! (+${value}% 점수)`,
              en: `${username} used a Score Boost! (+${value}% score)`
            }
          });
        }
      } else if (itemType === 'invincible' && value > 0) {
        // Invincible buff 추가
        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + value * 1000); // value는 초 단위

        const participantIndex = arena.participants.findIndex(
          (p: any) => String((p.user as any)?._id ?? p.user) === userId
        );

        if (participantIndex !== -1) {
          if (!arena.participants[participantIndex].activeBuffs) {
            arena.participants[participantIndex].activeBuffs = [];
          }

          // 기존 invincible 제거 후 새로 추가
          arena.participants[participantIndex].activeBuffs = arena.participants[participantIndex].activeBuffs.filter(
            (b: any) => b.type !== 'invincible'
          );

          arena.participants[participantIndex].activeBuffs.push({
            type: 'invincible',
            value,
            startedAt,
            expiresAt
          } as any);

          await arena.save();

          const user = await User.findById(userId).select('username').lean();
          const username = user?.username || 'Someone';

          io.to(arenaId).emit('arena:item-used', {
            userId,
            username,
            itemType,
            value,
            message: {
              ko: `${username}님이 무적권을 사용했습니다! (${value}초 동안 패널티 무시)`,
              en: `${username} used Invincibility! (Ignoring penalties for ${value} sec)`
            }
          });
        }
      }

    } catch (e) {
      console.error('[arena:use-item] error:', e);
      socket.emit('arena:use-item-failed', { reason: '아이템 사용 중 오류가 발생했습니다.' });
    }
  });

  // 10. [추가] 설정 변경 (arena:settingsChange)
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
      if (newSettings.maxParticipants && newSettings.maxParticipants >= activeParticipantsCount && newSettings.maxParticipants <= MAX_PLAYERS) {
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
          mode: populated?.mode,
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
}