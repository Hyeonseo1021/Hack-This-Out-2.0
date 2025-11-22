import User from '../../models/User';
import { Document } from 'mongoose';

interface IUser extends Document {
    username: string;
    password: string;
    email: string;
    avatar?: string;
    exp: number;
    level: number;
    rating: number;
    tier: number;
    htoCoin: number;
    isAdmin: boolean;
    updateLevel(): Promise<any>;
    updateTier(): Promise<any>;
}

export enum GameMode {
    TERMINAL_RACE = 'terminalRace',
    KING_OF_THE_HILL = 'kingOfTheHill',
    SOCIAL_ENGINEERING = 'socialEngineering',
    VULNERABILITY_SCANNER = 'vulnerabilityScanner',
    FORENSICS_RUSH = 'forensicsRush'
}

interface ExpCalculationParams {
    rank: number;
    score: number;
    gameMode: GameMode;
    totalPlayers: number;
    completionTime?: number; // 완료 시간 (초 단위)
}

interface ExpCalculationResult {
    baseExp: number;
    rankBonus: number;
    scoreBonus: number;
    timeBonus: number;
    gameModeMultiplier: number;
    totalExp: number;
}

// Game mode experience multipliers (based on difficulty)
const GAME_MODE_MULTIPLIERS: Record<GameMode, number> = {
    [GameMode.TERMINAL_RACE]: 0.8,          // Easy - 빠른 타이핑 게임
    [GameMode.SOCIAL_ENGINEERING]: 1.0,     // Normal - 중간 난이도
    [GameMode.VULNERABILITY_SCANNER]: 1.0,  // Normal - 중간 난이도
    [GameMode.KING_OF_THE_HILL]: 1.2,       // Hard - 경쟁 치열
    [GameMode.FORENSICS_RUSH]: 1.3          // Very Hard - 복잡한 파일 분석
};

// Base experience by rank (reduced for balance)
const RANK_BASE_EXP: Record<number, number> = {
    1: 20,  // 1등 (30 → 20)
    2: 15,  // 2등 (20 → 15)
    3: 12,  // 3등 (15 → 12)
    4: 8,   // 4등 (10 → 8)
    5: 6    // 5등 (8 → 6)
};

/**
 * Calculate arena experience points
 * @param params Parameters for experience calculation
 * @returns Experience calculation result
 */
export function calculateArenaExp(params: ExpCalculationParams): ExpCalculationResult {
    const { rank, score, gameMode, totalPlayers, completionTime } = params;

    // ✅ If score is 0, no EXP is awarded
    if (score === 0) {
        return {
            baseExp: 0,
            rankBonus: 0,
            scoreBonus: 0,
            timeBonus: 0,
            gameModeMultiplier: GAME_MODE_MULTIPLIERS[gameMode] || 1.0,
            totalExp: 0
        };
    }

    // 1. Base experience by rank
    const baseExp = RANK_BASE_EXP[rank] || (totalPlayers > 5 ? 6 : 5);

    // 2. Rank bonus (1st: +25%, 2nd: +15%, 3rd: +8%)
    let rankBonus = 0;
    if (rank === 1) {
        rankBonus = baseExp * 0.25;
    } else if (rank === 2) {
        rankBonus = baseExp * 0.15;
    } else if (rank === 3) {
        rankBonus = baseExp * 0.08;
    }

    // 3. Score bonus (1.5% of score, reduced from 2%)
    const scoreBonus = Math.floor(score * 0.015);

    // 4. Time bonus (빠른 완료 시 보너스, 최대 +10 EXP)
    let timeBonus = 0;
    if (completionTime && completionTime > 0) {
        // 3분(180초) 이내: +10, 5분(300초) 이내: +5, 그 이상: 0
        if (completionTime <= 180) {
            timeBonus = 10;
        } else if (completionTime <= 300) {
            timeBonus = 5;
        } else if (completionTime <= 420) {
            timeBonus = 2;
        }
    }

    // 5. Game mode multiplier
    const gameModeMultiplier = GAME_MODE_MULTIPLIERS[gameMode] || 1.0;

    // 6. Calculate total experience
    const totalExp = Math.floor((baseExp + rankBonus + scoreBonus + timeBonus) * gameModeMultiplier);

    return {
        baseExp,
        rankBonus,
        scoreBonus,
        timeBonus,
        gameModeMultiplier,
        totalExp
    };
}

/**
 * Assign arena experience to a user and update their level
 * @param userId User ID
 * @param params Parameters for experience calculation
 * @returns Updated user information and experience calculation result
 */
export async function assignArenaExp(
    userId: string,
    params: ExpCalculationParams
): Promise<{
    user: IUser;
    expResult: ExpCalculationResult;
    leveledUp: boolean;
    previousLevel: number;
    newLevel: number;
}> {
    // Calculate experience
    const expResult = calculateArenaExp(params);

    // Find user
    const user = await User.findById(userId) as IUser | null;
    if (!user) {
        throw new Error('User not found');
    }

    // Save previous level
    const previousLevel = user.level;

    // Add experience
    user.exp += expResult.totalExp;

    // Update level (this may save if level changed)
    await user.updateLevel();

    // ✅ Save user to database if level didn't change (updateLevel() only saves when level changes)
    // If level changed, updateLevel() already saved, but calling save() again is safe
    await user.save();

    // Check if leveled up
    const leveledUp = user.level > previousLevel;

    return {
        user,
        expResult,
        leveledUp,
        previousLevel,
        newLevel: user.level
    };
}

/**
 * Assign arena experience to multiple users in batch
 * @param results Array containing rank, score, completionTime, and user ID for each user
 * @param gameMode Game mode
 * @returns Update results for each user
 */
export async function assignBatchArenaExp(
    results: Array<{ userId: string; rank: number; score: number; completionTime?: number }>,
    gameMode: GameMode
): Promise<Array<{
    userId: string;
    user: IUser;
    expResult: ExpCalculationResult;
    leveledUp: boolean;
    previousLevel: number;
    newLevel: number;
}>> {
    const totalPlayers = results.length;
    const updateResults = [];

    for (const result of results) {
        try {
            const updateResult = await assignArenaExp(result.userId, {
                rank: result.rank,
                score: result.score,
                gameMode,
                totalPlayers,
                completionTime: result.completionTime
            });

            updateResults.push({
                userId: result.userId,
                ...updateResult
            });
        } catch (error) {
            console.error(`Failed to assign exp to user ${result.userId}:`, error);
        }
    }

    return updateResults;
}
