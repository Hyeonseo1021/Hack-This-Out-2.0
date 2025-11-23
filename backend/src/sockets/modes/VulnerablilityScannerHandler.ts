// handlers/VulnerabilityScannerRaceHandler.ts

import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import {
  processVulnerabilitySubmission,
  requestHint,
  getGameState
} from '../../services/vulnerbilityScannerRace/vulnerabilityScannerEngine';
import { generateVulnerableHTML } from '../../services/vulnerbilityScannerRace/generateVulnerableHTML';
import { endArenaProcedure } from '../utils/endArenaProcedure';

/**
 * 🔍 Vulnerability Scanner Race Socket Handlers
 */

export const registerVulnerabilityScannerRaceHandlers = (io: Server, socket: Socket) => {
  
  /**
   * 취약점 제출
   */
  socket.on('scannerRace:submit', async ({
    vulnType,
    endpoint,
    parameter,
    payload
  }: {
    vulnType: string;
    endpoint: string;
    parameter: string;
    payload: string;
  }) => {
    
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n🔍 [scannerRace:submit] Arena: ${arenaId}, User: ${userId}`);
    console.log(`   VulnType: ${vulnType}, Endpoint: ${endpoint}`);

    if (!arenaId || !userId) {
      socket.emit('scannerRace:error', { message: 'Invalid request' });
      return;
    }

    try {
      // 1. 제출 처리
      const result = await processVulnerabilitySubmission({
        arenaId,
        userId,
        vulnType,
        endpoint,
        parameter,
        payload
      });

      console.log('📤 [scannerRace:submit] Result:', result);

      if (!result.success) {
        socket.emit('scannerRace:submission-failed', {
          message: result.message,
          isCorrect: result.isCorrect,
          pointsAwarded: result.pointsAwarded
        });
        return;
      }

      // 2. 제출자에게 결과 전송
      socket.emit('scannerRace:submission-success', {
        message: result.message,
        isFirstBlood: result.isFirstBlood,
        pointsAwarded: result.pointsAwarded,
        breakdown: result.breakdown,
        vulnInfo: result.vulnInfo
      });

      // 3. 현재 플레이어 점수
      const progress = await ArenaProgress.findOne({ arena: arenaId, user: userId });

      // 4. 모든 플레이어에게 발견 알림 브로드캐스트
      io.to(arenaId).emit('scannerRace:vulnerability-found', {
        userId,
        vulnType: result.vulnInfo?.vulnType,
        vulnName: result.vulnInfo?.vulnName,
        isFirstBlood: result.isFirstBlood,
        points: result.pointsAwarded,
        currentScore: progress?.score || 0
      });

      // 5. 실시간 점수 업데이트
      const allProgress = await ArenaProgress.find({ arena: arenaId })
        .select('user score vulnerabilityScannerRace')
        .populate('user', 'username')
        .lean(); // ✅ lean() 추가

      io.to(arenaId).emit('scannerRace:scores-update', {
        scores: allProgress.map((p: any) => {
          const pUser = p.user as any;
          return {
            userId: pUser?._id || pUser,
            username: pUser?.username || 'Unknown',
            score: p.score || 0,
            vulnerabilitiesFound: p.vulnerabilityScannerRace?.vulnerabilitiesFound || 0,
            firstBloods: p.vulnerabilityScannerRace?.firstBloods || 0
          };
        })
      });

      // 6. 게임 종료 체크
      const arena = await Arena.findById(arenaId);
      if (arena?.status === 'ended') {
        console.log('🏁 [scannerRace:submit] Game ended! Calling endArenaProcedure...');
        // ✅ endArenaProcedure 호출하여 경험치 계산 및 게임 종료
        await endArenaProcedure(arenaId, io);
      }

    } catch (error) {
      console.error('[scannerRace:submit] Error:', error);
      socket.emit('scannerRace:error', {
        message: 'Error processing submission'
      });
    }
  });

  /**
   * 힌트 요청
   */
  socket.on('scannerRace:request-hint', async ({
    vulnId,
    hintLevel
  }: {
    vulnId: string;
    hintLevel: number;
  }) => {
    
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n💡 [scannerRace:request-hint] VulnId: ${vulnId}, Level: ${hintLevel}`);

    if (!arenaId || !userId) {
      socket.emit('scannerRace:error', { message: 'Invalid request' });
      return;
    }

    try {
      const result = await requestHint(arenaId, userId, vulnId, hintLevel);

      if (!result.success) {
        socket.emit('scannerRace:hint-failed', {
          message: result.message
        });
        return;
      }

      socket.emit('scannerRace:hint-received', {
        hint: result.hint,
        cost: result.cost,
        vulnId
      });

      const progress = await ArenaProgress.findOne({ arena: arenaId, user: userId });
      
      socket.emit('scannerRace:score-update', {
        score: progress?.score || 0,
        change: -(result.cost || 0)
      });

    } catch (error) {
      console.error('[scannerRace:request-hint] Error:', error);
      socket.emit('scannerRace:error', {
        message: 'Error requesting hint'
      });
    }
  });

  /**
   * 게임 상태 조회
   */
  socket.on('scannerRace:get-state', async () => {

    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n📊 [scannerRace:get-state] Arena: ${arenaId}, User: ${userId}`);

    if (!arenaId || !userId) {
      socket.emit('scannerRace:error', { message: 'Invalid request' });
      return;
    }

    try {
      const gameState = await getGameState(arenaId, userId);

      if (!gameState) {
        socket.emit('scannerRace:error', { message: 'Failed to load game state' });
        return;
      }

      // Arena에서 mode와 vulnerableHTML 가져오기
      const arena = await Arena.findById(arenaId);
      const mode = arena?.modeSettings?.vulnerabilityScannerRace?.mode || 'SIMULATED';
      const vulnerableHTML = arena?.modeSettings?.vulnerabilityScannerRace?.vulnerableHTML || '';

      socket.emit('scannerRace:state-data', {
        ...gameState,
        mode,
        vulnerableHTML
      });

    } catch (error) {
      console.error('[scannerRace:get-state] Error:', error);
      socket.emit('scannerRace:error', {
        message: 'Error loading game state'
      });
    }
  });

  /**
   * 취약점 목록 조회
   */
  socket.on('scannerRace:get-vulnerabilities', async () => {
    
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n🔎 [scannerRace:get-vulnerabilities] Arena: ${arenaId}`);

    if (!arenaId || !userId) {
      socket.emit('scannerRace:error', { message: 'Invalid request' });
      return;
    }

    try {
      const arena = await Arena.findById(arenaId).populate('scenarioId');
      if (!arena) {
        socket.emit('scannerRace:error', { message: 'Arena not found' });
        return;
      }

      const scenario = arena.scenarioId as any;
      const vulnerabilities = arena.modeSettings?.vulnerabilityScannerRace?.vulnerabilities || [];

      const vulnStatus = vulnerabilities.map((vuln: any) => {
        const discovered = vuln.discovered || [];
        const myDiscovery = discovered.find((d: any) => 
          d.user.toString() === userId.toString()
        );

        return {
          vulnId: vuln.vulnId,
          vulnType: vuln.vulnType,
          difficulty: vuln.difficulty,
          basePoints: vuln.basePoints,
          category: vuln.category || 'General',
          discovered: discovered.length > 0,
          discoveredByMe: !!myDiscovery,
          isFirstBlood: myDiscovery?.isFirstBlood || false,
          pointsEarned: myDiscovery?.pointsAwarded || 0
        };
      });

      socket.emit('scannerRace:vulnerabilities-data', {
        vulnerabilities: vulnStatus,
        totalVulnerabilities: scenario.data?.totalVulnerabilities || 0,
        targetUrl: scenario.data?.targetUrl || '',
        targetName: scenario.data?.targetName || '',
        features: scenario.data?.features || []
      });

    } catch (error) {
      console.error('[scannerRace:get-vulnerabilities] Error:', error);
      socket.emit('scannerRace:error', {
        message: 'Error loading vulnerabilities'
      });
    }
  });

  /**
   * 실시간 점수 조회
   */
  socket.on('scannerRace:get-scores', async () => {
    
    const arenaId = (socket as any).arenaId;

    if (!arenaId) {
      socket.emit('scannerRace:error', { message: 'Invalid request' });
      return;
    }

    try {
      const allProgress = await ArenaProgress.find({ arena: arenaId })
        .select('user score vulnerabilityScannerRace')
        .populate('user', 'username')
        .sort({ score: -1 })
        .lean(); // ✅ lean() 추가

      socket.emit('scannerRace:scores-data', {
        scores: allProgress.map((p: any, index: number) => {
          const pUser = p.user as any;
          return {
            rank: index + 1,
            userId: pUser?._id || pUser,
            username: pUser?.username || 'Unknown',
            score: p.score || 0,
            vulnerabilitiesFound: (p.vulnerabilityScannerRace as any)?.vulnerabilitiesFound || 0,
            firstBloods: (p.vulnerabilityScannerRace as any)?.firstBloods || 0,
            invalidSubmissions: (p.vulnerabilityScannerRace as any)?.invalidSubmissions || 0
          };
        })
      });

    } catch (error) {
      console.error('[scannerRace:get-scores] Error:', error);
      socket.emit('scannerRace:error', {
        message: 'Error loading scores'
      });
    }
  });

  /**
   * 내 통계 조회
   */
  socket.on('scannerRace:get-my-stats', async () => {
    
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    if (!arenaId || !userId) {
      socket.emit('scannerRace:error', { message: 'Invalid request' });
      return;
    }

    try {
      const progress = await ArenaProgress.findOne({ arena: arenaId, user: userId }).lean();

      if (!progress) {
        socket.emit('scannerRace:error', { message: 'Progress not found' });
        return;
      }

      const stats = (progress.vulnerabilityScannerRace as any) || {};

      socket.emit('scannerRace:my-stats-data', {
        score: progress.score || 0,
        vulnerabilitiesFound: stats.vulnerabilitiesFound || 0,
        firstBloods: stats.firstBloods || 0,
        invalidSubmissions: stats.invalidSubmissions || 0,
        hintsUsed: stats.hintsUsed || 0,
        speedBonusPoints: stats.speedBonusPoints || 0,
        comboPoints: stats.comboPoints || 0,
        discoveries: stats.discoveries || [],
        submissions: stats.submissions || []
      });

    } catch (error) {
      console.error('[scannerRace:get-my-stats] Error:', error);
      socket.emit('scannerRace:error', {
        message: 'Error loading stats'
      });
    }
  });
};

/**
 * 🎬 게임 시작 시 초기화
 */
export async function initializeScannerRace(arenaId: string): Promise<void> {

  const startTime = Date.now();
  console.log('🎬 [initializeScannerRace] Initializing...');

  try {
    const t1 = Date.now();
    const arena = await Arena.findById(arenaId).populate('scenarioId');
    if (!arena) return;

    const scenario = arena.scenarioId as any;
    const vulnerabilities = scenario.data?.vulnerabilities || [];
    const mode = scenario.data?.mode || 'SIMULATED';

    console.log(`📊 [initializeScannerRace] Mode: ${mode}, DB fetch took ${Date.now() - t1}ms`);

    // 시나리오 생성 시 저장된 HTML 사용
    let vulnerableHTML = '';

    if (mode === 'SIMULATED') {
      const t2 = Date.now();
      // 시나리오 생성 시 이미 생성된 HTML 사용
      vulnerableHTML = scenario.data?.generatedHTML || '';

      if (!vulnerableHTML) {
        console.warn('⚠️ [initializeScannerRace] No generated HTML found in scenario. Generating fallback...');
        vulnerableHTML = await generateVulnerableHTML(scenario);
        console.log(`⏱️ [initializeScannerRace] HTML generation took ${Date.now() - t2}ms`);
      } else {
        console.log(`✅ [initializeScannerRace] Using pre-generated HTML (${vulnerableHTML.length} characters), took ${Date.now() - t2}ms`);
      }
    } else {
      // REAL 모드: 실제 웹 사용
      console.log(`🌐 [initializeScannerRace] Using real web: ${scenario.data?.targetUrl}`);
    }

    // Arena에 취약점 초기화
    const t3 = Date.now();
    await Arena.updateOne(
      { _id: arenaId },
      {
        $set: {
          'modeSettings.vulnerabilityScannerRace': {
            mode,
            vulnerableHTML,
            totalVulnerabilities: vulnerabilities.length,
            vulnerabilities: vulnerabilities.map((v: any) => ({
              vulnId: v.vulnId,
              vulnType: v.vulnType,
              endpoint: v.endpoint,
              parameter: v.parameter,
              basePoints: v.basePoints,
              difficulty: v.difficulty,
              discovered: []
            })),
            targetUrl: scenario.data?.targetUrl || '',
            targetDescription: scenario.data?.targetDescription || '',
            hints: scenario.data?.hints || []
          }
        }
      }
    );
    console.log(`⏱️ [initializeScannerRace] Arena update took ${Date.now() - t3}ms`);

    // 각 플레이어의 ArenaProgress 초기화
    const t4 = Date.now();
    const participants = arena.participants.map((p: any) => p.user);

    for (const userId of participants) {
      await ArenaProgress.updateOne(
        { arena: arenaId, user: userId },
        {
          $set: {
            'vulnerabilityScannerRace': {
              vulnerabilitiesFound: 0,
              firstBloods: 0,
              invalidSubmissions: 0,
              hintsUsed: 0,
              speedBonusPoints: 0,
              comboPoints: 0,
              discoveries: [],
              submissions: []
            }
          }
        },
        { upsert: true }
      );
    }
    console.log(`⏱️ [initializeScannerRace] ArenaProgress updates took ${Date.now() - t4}ms (${participants.length} participants)`);


    console.log(`✅ [initializeScannerRace] Initialized successfully in ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error('[initializeScannerRace] Error:', error);
  }
}