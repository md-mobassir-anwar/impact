"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./database");
const demo_data_1 = require("./services/demo-data");
const orders_1 = __importDefault(require("./routes/orders"));
const agents_1 = __importDefault(require("./routes/agents"));
const optimization_1 = __importDefault(require("./routes/optimization"));
const simulation_1 = __importDefault(require("./routes/simulation"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const settings_1 = __importDefault(require("./routes/settings"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// CORS configuration
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Body parsers
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'RouteWise backend', timestamp: new Date().toISOString() });
});
// Mount route handlers
app.use('/api/orders', orders_1.default);
app.use('/api/agents', agents_1.default);
app.use('/api/optimize', optimization_1.default);
app.use('/api/simulation', simulation_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/settings', settings_1.default);
// Notification route aliases so both /api/notifications and /api/settings/notifications work
app.use('/api', settings_1.default);
// 404 handler for undefined routes
app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// Global error handler middleware
app.use((err, _req, res, _next) => {
    console.error('Unhandled RouteWise server error:', err);
    const status = err.status || 500;
    res.status(status).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});
// Initialize database and optionally seed demo data if empty
const db = (0, database_1.initializeDatabase)();
if (!(0, demo_data_1.isDemoDataLoaded)(db)) {
    const existingOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
    if (existingOrders.count === 0) {
        (0, demo_data_1.loadDemoData)(db);
        console.log('Seeded demo dataset for RouteWise');
    }
}
// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`RouteWise backend running on port ${PORT}`);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map