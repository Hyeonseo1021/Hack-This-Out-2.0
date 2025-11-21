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
}

interface ExpCalculationResult {
    baseExp: number;
    rankBonus: number;
    scoreBonus: number;
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
    1: 50,  // 1등
    2: 35,  // 2등
    3: 25,  // 3등
    4: 18,  // 4등
    5: 12   // 5등
};

/**
 * Calculate arena experience points
 * @param params Parameters for experience calculation
 * @returns Experience calculation result
 */
export function calculateArenaExp(params: ExpCalculationParams): ExpCalculationResult {
    const { rank, score, gameMode, totalPlayers } = params;

    // 1. Base experience by rank
    const baseExp = RANK_BASE_EXP[rank] || (totalPlayers > 5 ? 10 : 8);

    // 2. Rank bonus (1st: +30%, 2nd: +20%, 3rd: +10%)
    let rankBonus = 0;
    if (rank === 1) {
        rankBonus = baseExp * 0.3;
    } else if (rank === 2) {
        rankBonus = baseExp * 0.2;
    } else if (rank === 3) {
        rankBonus = baseExp * 0.1;
    }

    // 3. Score bonus (5% of score, reduced from 10%)
    const scoreBonus = Math.floor(score * 0.05);

    // 4. Game mode multiplier
    const gameModeMultiplier = GAME_MODE_MULTIPLIERS[gameMode] || 1.0;

    // 5. Calculate total experience
    const totalExp = Math.floor((baseExp + rankBonus + scoreBonus) * gameModeMultiplier);

    return {
        baseExp,
        rankBonus,
        scoreBonus,
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

    // Update level
    await user.updateLevel();

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
 * @param results Array containing rank, score, and user ID for each user
 * @param gameMode Game mode
 * @returns Update results for each user
 */
export async function assignBatchArenaExp(
    results: Array<{ userId: string; rank: number; score: number }>,
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
                totalPlayers
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
