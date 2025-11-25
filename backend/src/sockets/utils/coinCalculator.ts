import User from '../../models/User';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
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
}

export enum GameMode {
    TERMINAL_RACE = 'TERMINAL_HACKING_RACE',
    SOCIAL_ENGINEERING = 'SOCIAL_ENGINEERING_CHALLENGE',
    VULNERABILITY_SCANNER = 'VULNERABILITY_SCANNER_RACE',
    FORENSICS_RUSH = 'FORENSICS_RUSH'
}

interface CoinCalculationParams {
    rank: number;
    score: number;
    gameMode: GameMode;
    completionTime?: number; // 완료 시간 (초 단위)
    isFirstClear: boolean; // 해당 시나리오를 처음 완료했는지
}

interface CoinCalculationResult {
    baseCoin: number;
    rankBonus: number;
    scoreBonus: number;
    timeBonus: number;
    firstClearBonus: number;
    totalCoin: number;
}

// Game mode base coins (based on difficulty)
const GAME_MODE_BASE_COINS: Record<GameMode, number> = {
    [GameMode.TERMINAL_RACE]: 2,           // Easy
    [GameMode.SOCIAL_ENGINEERING]: 3,      // Normal
    [GameMode.VULNERABILITY_SCANNER]: 3,   // Normal
    [GameMode.FORENSICS_RUSH]: 5           // Very Hard
};

/**
 * Calculate HTO coin rewards for arena completion
 * @param params Parameters for coin calculation
 * @returns Coin calculation result
 */
export function calculateArenaCoin(params: CoinCalculationParams): CoinCalculationResult {
    const { rank, score, gameMode, completionTime, isFirstClear } = params;

    // ✅ If score is 0, no coins are awarded
    if (score === 0) {
        return {
            baseCoin: 0,
            rankBonus: 0,
            scoreBonus: 0,
            timeBonus: 0,
            firstClearBonus: 0,
            totalCoin: 0
        };
    }

    // 1. Base coins by game mode
    const baseCoin = GAME_MODE_BASE_COINS[gameMode] || 2;

    // 2. Rank bonus
    let rankBonus = 0;
    if (rank === 1) {
        rankBonus = 5;  // 1st place: +5 HTO
    } else if (rank === 2) {
        rankBonus = 3;  // 2nd place: +3 HTO
    } else if (rank === 3) {
        rankBonus = 2;  // 3rd place: +2 HTO
    } else if (rank <= 5) {
        rankBonus = 1;  // 4th-5th place: +1 HTO
    }

    // 3. Score bonus
    let scoreBonus = 0;
    if (score >= 100) {
        scoreBonus = 3;  // Perfect score: +3 HTO
    } else if (score >= 90) {
        scoreBonus = 2;  // 90+: +2 HTO
    } else if (score >= 80) {
        scoreBonus = 1;  // 80+: +1 HTO
    }

    // 4. Time bonus (fast completion)
    let timeBonus = 0;
    if (completionTime && completionTime > 0) {
        // Within 3 minutes (180s): +2 HTO
        // Within 5 minutes (300s): +1 HTO
        if (completionTime <= 180) {
            timeBonus = 2;
        } else if (completionTime <= 300) {
            timeBonus = 1;
        }
    }

    // 5. First clear bonus (only for first completion of this scenario)
    const firstClearBonus = isFirstClear ? (baseCoin * 2) : 0; // 2x base coin for first clear

    // 6. Calculate total coins
    const totalCoin = baseCoin + rankBonus + scoreBonus + timeBonus + firstClearBonus;

    return {
        baseCoin,
        rankBonus,
        scoreBonus,
        timeBonus,
        firstClearBonus,
        totalCoin
    };
}

/**
 * Check if this is the user's first completion of the scenario
 * @param userId User ID
 * @param scenarioId Scenario ID
 * @returns True if this is the first completion
 */
export async function isFirstScenarioCompletion(
    userId: string,
    scenarioId: string
): Promise<boolean> {
    // Find all arenas with this scenario where user completed
    const previousCompletions = await Arena.find({ scenarioId })
        .select('_id')
        .lean();

    if (previousCompletions.length === 0) {
        return true; // No arenas with this scenario exist yet
    }

    const arenaIds = previousCompletions.map(a => a._id);

    // Check if user has completed any of these arenas before
    const userCompletions = await ArenaProgress.countDocuments({
        user: userId,
        arena: { $in: arenaIds },
        completed: true
    });

    // First completion if count is 0
    return userCompletions === 0;
}

/**
 * Assign arena coins to a user
 * @param userId User ID
 * @param params Parameters for coin calculation
 * @returns Updated user and coin calculation result
 */
export async function assignArenaCoin(
    userId: string,
    params: CoinCalculationParams
): Promise<{
    user: IUser;
    coinResult: CoinCalculationResult;
}> {
    // Calculate coins
    const coinResult = calculateArenaCoin(params);

    // Find user
    const user = await User.findById(userId) as IUser | null;
    if (!user) {
        throw new Error('User not found');
    }

    // Add coins
    user.htoCoin += coinResult.totalCoin;
    await user.save();

    return {
        user,
        coinResult
    };
}

/**
 * Assign arena coins to multiple users in batch
 * @param results Array containing rank, score, completionTime, isFirstClear, and user ID
 * @param gameMode Game mode
 * @returns Update results for each user
 */
export async function assignBatchArenaCoin(
    results: Array<{
        userId: string;
        rank: number;
        score: number;
        completionTime?: number;
        isFirstClear: boolean;
    }>,
    gameMode: GameMode
): Promise<Array<{
    userId: string;
    user: IUser;
    coinResult: CoinCalculationResult;
}>> {
    const updateResults = [];

    for (const result of results) {
        try {
            const updateResult = await assignArenaCoin(result.userId, {
                rank: result.rank,
                score: result.score,
                gameMode,
                completionTime: result.completionTime,
                isFirstClear: result.isFirstClear
            });

            updateResults.push({
                userId: result.userId,
                ...updateResult
            });
        } catch (error) {
            console.error(`Failed to assign coins to user ${result.userId}:`, error);
        }
    }

    return updateResults;
}
