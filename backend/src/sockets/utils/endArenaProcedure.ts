import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import User from '../../models/User';

export const endArenaProcedure = async (arenaId: string, io: Server) => {
  try {
    const arena = await Arena.findById(arenaId);
    if (!arena || arena.status === 'ended') return;

    arena.status = 'ended';
    if (!arena.endTime) {
      arena.endTime = new Date();
    }
    
    // 1. ArenaProgress에서 랭킹 계산
    const progressLogs = await ArenaProgress.find({ arena: arenaId })
      .sort({ score: -1, completed: -1, updatedAt: 1 }) 
      .populate('user', '_id username')
      .lean();
      
    // 2. Arena 모델에 랭킹 정보 저장
    arena.ranking = progressLogs.map((log, index) => ({
      user: (log.user as any)._id,
      rank: index + 1,
    })) as any;
    
    // 3. 승자 결정 (1등)
    if (progressLogs.length > 0) {
      arena.winner = (progressLogs[0].user as any)._id;
    }

    await arena.save();

    // ✅ 모드별 경험치 배율 (새로운 모드명으로 수정)
    const modeMultiplier: Record<string, number> = {
      'TERMINAL_HACKING_RACE': 1.0,
      'CYBER_DEFENSE_BATTLE': 1.5,
      'CAPTURE_THE_SERVER': 1.8,
      'HACKERS_DECK': 1.3,
      'EXPLOIT_CHAIN_CHALLENGE': 2.0,
    };

    const baseExp = arena.arenaExp || 50;
    const modeFactor = modeMultiplier[arena.mode] || 1.0;

    // 순위별 경험치 배율
    const rankMultipliers = [1.0, 0.5, 0.25]; // 1등, 2등, 3등
    const defaultRankMultiplier = 0.1; // 4등 이하

    // 각 참가자에게 경험치 지급
    for (let i = 0; i < arena.ranking.length; i++) {
      const { user, rank } = arena.ranking[i];
      const rankMultiplier =
        rankMultipliers[i] !== undefined ? rankMultipliers[i] : defaultRankMultiplier;
      const gainedExp = Math.floor(baseExp * modeFactor * rankMultiplier);

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

    console.log(`✅ [endArenaProcedure] Arena ${arenaId} has ended.`);

    // 방에 있는 모든 사람에게 종료 알림
    io.to(arenaId).emit('arena:ended', { 
      arenaId, 
      endTime: arena.endTime,
      ranking: arena.ranking,
      winner: arena.winner
    });
    
    // 로비에서 방 제거
    io.emit('arena:room-deleted', arenaId);

  } catch (e) {
    console.error(`❌ [endArenaProcedure] error:`, e);
  }
};