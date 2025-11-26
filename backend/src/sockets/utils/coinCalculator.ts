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
    [GameMode.TERMINAL_RACE]: 1,           // Easy
    [GameMode.SOCIAL_ENGINEERING]: 1,      // Normal
    [GameMode.VULNERABILITY_SCANNER]: 2,   // Normal
    [GameMode.FORENSICS_RUSH]: 3           // Very Hard
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

    // ✅ If not first clear of this scenario, no coins are awarded
    if (!isFirstClear) {
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

    // 2. Rank bonus (only top 3 get bonus)
    let rankBonus = 0;
    if (rank === 1) {
        rankBonus = 2;  // 1st place: +2 HTO
    } else if (rank === 2) {
        rankBonus = 1;  // 2nd place: +1 HTO
    }
    // 3rd place and below: no rank bonus

    // 3. Score bonus (only perfect score gets bonus)
    let scoreBonus = 0;
    if (score >= 100) {
        scoreBonus = 1;  // Perfect score: +1 HTO
    }

    // 4. Time bonus removed - no time bonus

    // 5. First clear bonus (only for first completion of this scenario)
    const firstClearBonus = isFirstClear ? baseCoin : 0; // 1x base coin for first clear

    // 6. Calculate total coins
    const totalCoin = baseCoin + rankBonus + scoreBonus + firstClearBonus;

    return {
        baseCoin,
        rankBonus,
        scoreBonus,
        timeBonus: 0,
        firstClearBonus,
        totalCoin
    };
}

/**
 * Check if this is the user's first completion of the scenario
 * @param userId User ID
 * @param scenarioId Scenario ID
 * @param currentArenaId Current arena ID to exclude from check
 * @returns True if this is the first completion
 */
export async function isFirstScenarioCompletion(
    userId: string,
    scenarioId: string,
    currentArenaId?: string
): Promise<boolean> {
    // Find all ENDED arenas with this scenario (exclude current arena)
    const query: any = {
        scenarioId,
        status: 'ended'  // Only check ended arenas
    };

    if (currentArenaId) {
        query._id = { $ne: currentArenaId };  // Exclude current arena
    }

    const previousArenas = await Arena.find(query)
        .select('_id')
        .lean();

    if (previousArenas.length === 0) {
        return true; // No previous arenas with this scenario
    }

    const arenaIds = previousArenas.map(a => a._id);

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
