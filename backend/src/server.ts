import express from 'express';
import http from 'http';
import connectDB from './config/db';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import userRoutes from "./routes/UserRoutes";
import InstRoutes from "./routes/InstRoutes";
import MachineRoutes from './routes/MachineRoutes';
import ContestRoutes from './routes/ContestRoutes';
import ArenaRoutes from './routes/ArenaRoutes';
import ItemRoutes from './routes/ItemRoutes';
import { initializeSocket } from './config/socket';

// **Import the Instance Cleanup Scheduler**
import './middlewares/instanceCleanup';

const app = express();

// DB Connection
connectDB();

// CORS Configuration
app.use(cors({
    origin: process.env.ORIGIN_URL,
    credentials: true
}));

// Cookie Parser
app.use(cookieParser(process.env.COOKIE_SECRET));

// Logger
app.use(morgan("dev"));

// Middleware
app.use(express.json());
app.use(mongoSanitize());

// Routes
app.use('/api/user', userRoutes);
app.use('/api/inst', InstRoutes);
app.use('/api/machines', MachineRoutes);
app.use('/api/contest', ContestRoutes);
app.use('/api/arena', ArenaRoutes);
app.use('/api/shop', ItemRoutes);


// Root Endpoint
app.get('/', (req, res) => res.send('API is running'));

// Server Port
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
initializeSocket(server, app);
// Start Server
server.listen(PORT, () => {
    console.log(`Server starts on port ${PORT}`);
});