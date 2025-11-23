import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

/**
 * Middleware to verify if the user is an admin.
 */
export const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.jwtData.id;
        console.log(`🔐 [verifyAdmin] Checking admin status for user: ${userId}`);

        const user = await User.findById(userId);
        if (user && user.isAdmin) {
            console.log(`✅ [verifyAdmin] User ${userId} is admin - access granted`);
            next();
        } else {
            console.warn(`⛔ [verifyAdmin] User ${userId} is NOT admin - access denied`);
            res.status(403).json({ msg: 'Access denied. Admins only.' });
        }
    } catch (error) {
        console.error('❌ [verifyAdmin] Error:', error);
        res.status(500).send('Server error');
    }
};

