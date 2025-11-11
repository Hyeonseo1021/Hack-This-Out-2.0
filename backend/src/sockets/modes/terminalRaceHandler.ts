import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { terminalProcessCommand } from '../../services/terminalRace/terminalEngine';
import { endArenaProcedure } from '../utils/endArenaProcedure';

export const registerTerminalRaceHandlers = (io: Server, socket: Socket) => {
  socket.on('terminal:execute', async ({ 
    command 
  }: { command: string }) => {
    
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;
    if (!arenaId || !userId) return;

    try {
      // 1. Arena 상태 확인
      const arena = await Arena.findById(arenaId).select('mode status winner');
      if (!arena) throw new Error('Arena not found');
      if (arena.mode !== 'TERMINAL_HACKING_RACE') {
        throw new Error('Invalid action for this Arena mode');
      }
      if (arena.status !== 'started') {
        throw new Error('Arena is not started');
      }
      
      // ✅ 이미 게임이 종료된 경우 (승자가 있음)
      if (arena.winner) {
        socket.emit('terminal:result', {
          userId,
          command,
          message: '⚠️ Game has already ended. Winner has been determined.',
          progressDelta: 0,
          flagFound: false
        });
        return;
      }
      
      // 2. 명령어 처리
      const result = await terminalProcessCommand(arenaId, userId, command);

      // ✅ 현재 진행 상황 가져오기 (stage 정보를 위해)
      const currentProgress = await ArenaProgress.findOne({ arena: arenaId, user: userId });
      const currentStage = currentProgress?.stage || 0;

      // 3. 업데이트 페이로드 구성
      const incUpdate: any = { score: result.progressDelta || 0 };
      if (result.advanceStage) {
        incUpdate.stage = 1; // 스테이지 1 증가
      }
      
      const updatePayload: any = {
        $inc: incUpdate,
        $push: { 
          flags: {
            stage: currentStage + 1, // ✅ 현재 플레이 중인 스테이지 번호 기록
            correct: result.flagFound || false,
            submittedAt: new Date()
          }
        }
      };
      
      if (result.flagFound) {
        updatePayload.$set = { completed: true };
      }

      console.log('📝 Update Payload:', JSON.stringify(updatePayload, null, 2));

      // 4. ArenaProgress 업데이트
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
        userId,
        stage: progressDoc.stage,
        score: progressDoc.score,
        completed: progressDoc.completed
      });
      console.log('---\n');
      
      // 5. 클라이언트에 결과 전송
      io.to(arenaId).emit('terminal:result', {
        userId,
        command,
        message: result.message,
        progressDelta: result.progressDelta,
        flagFound: result.flagFound,
        newScore: progressDoc.score,      // ✅ 현재 총점 추가
        newStage: progressDoc.stage,      // ✅ 현재 스테이지 추가
        completed: progressDoc.completed  // ✅ 완료 여부 추가
      });

      // ✅ 전체 참가자 진행 상황 브로드캐스트
      io.to(arenaId).emit('participant:update', {
        userId,
        progress: {
          score: progressDoc.score,
          stage: progressDoc.stage,
          completed: progressDoc.completed
        }
      });
      
      // 6. 게임 종료 처리
      if (result.flagFound && !arena.winner) {
        console.log(`🏆 Winner detected: ${userId}`);
        
        // Arena 모델에 승자 기록
        arena.winner = userId;
        arena.firstSolvedAt = new Date();
        await arena.save();
        
        // 즉시 게임 종료
        await endArenaProcedure(arenaId, io);
      }

    } catch (e) {
      console.error('[terminal:execute] error:', e);
      socket.emit('arena:action-failed', { 
        reason: (e as Error).message || 'An error occurred' 
      });
    }
  });

  // ✅ 진행 상황 조회 개선
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
          completed: false,
          flags: []  // ✅ 빈 배열 추가
        });
        return;
      }

      // 진행 상황 반환
      socket.emit('terminal:progress-data', {
        stage: progressDoc.stage || 0,
        score: progressDoc.score || 0,
        completed: progressDoc.completed || false,
        flags: progressDoc.flags || []  // ✅ 제출 기록도 반환
      });

    } catch (e) {
      console.error('[terminal:get-progress] error:', e);
      socket.emit('terminal:progress-data', {
        stage: 0,
        score: 0,
        completed: false,
        flags: []
      });
    }
  });

  // ✅ 새로운 이벤트: 현재 스테이지 프롬프트 가져오기
  socket.on('terminal:get-prompt', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    if (!arenaId || !userId) return;

    try {
      // Arena에서 시나리오 정보 가져오기
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        socket.emit('terminal:prompt-data', { prompt: 'Scenario not found.' });
        return;
      }

      // 유저의 현재 스테이지
      const progressDoc = await ArenaProgress.findOne({ arena: arenaId, user: userId });
      const currentStage = (progressDoc?.stage || 0) + 1;

      // 시나리오 데이터에서 프롬프트 찾기
      const scenario = arena.scenarioId as any;
      const stageData = scenario.data.stages.find((s: any) => s.stage === currentStage);

      if (stageData) {
        socket.emit('terminal:prompt-data', { 
          prompt: stageData.prompt,
          stage: currentStage,
          totalStages: scenario.data.totalStages
        });
      } else {
        socket.emit('terminal:prompt-data', { 
          prompt: 'All stages completed!',
          stage: currentStage,
          totalStages: scenario.data.totalStages
        });
      }

    } catch (e) {
      console.error('[terminal:get-prompt] error:', e);
      socket.emit('terminal:prompt-data', { prompt: 'Error loading prompt.' });
    }
  });
};