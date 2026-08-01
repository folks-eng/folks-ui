const fs = require('fs');
const path = require('path');
const util = require('util');

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const COLORS = {
    debug: '\x1b[36m',      // Cyan
    // info: '\x1b[32m',    // Green
    info: '\x1b[39m',       // Black
    warn: '\x1b[33m',       // Yellow
    error: '\x1b[31m',      // Red
    reset: '\x1b[0m'
};

const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()];

class Logger {
    
    static logStream = null;
    static logToFile = false;
    static logFile = null;
    
    static configure() {
        if (Logger.logStream) {
            return;
        }
        Logger.logToFile = (process.env.LOG_TO_FILE || 'false').toLowerCase() === 'true';
        Logger.logFile = process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'node_server.log');

        if (Logger.logToFile) {
            fs.mkdirSync(path.dirname(Logger.logFile), { recursive: true });
            
            Logger.logStream = fs.createWriteStream(Logger.logFile, {
                flags: 'a',
                encoding: 'utf8'
            });
            Logger.logStream.on('error', err => {
                console.error('Logger stream error:', err);
            });
        }
    }
    
    constructor(module) {
        this.module = module;
    }
    
    isEnabled(level) {
        return LOG_LEVELS[level] >= currentLevel;
    }

    isDebugEnabled() {
        return this.isEnabled('debug');
    }

    isInfoEnabled() {
        return this.isEnabled('info');
    }

    isWarnEnabled() {
        return this.isEnabled('warn');
    }

    log(level, ...args) {
        if (LOG_LEVELS[level] < currentLevel) {
            return;
        }

        let timestamp = new Date().toISOString();

        // util.format() works like printf() in C.
        // E.g.,
        // 1. util.format("Age %d", 25)         => "Age 25"
        // 2. util.format("Hello %s", "John")   => "Hello John"
        // 3. util.format("%i", 12.8)           => "12"
        // 4. util.format("%f", 12.8)           => "12.8"
        let message = util.format(...args);
        let stmt = `[${timestamp}] [${level.toUpperCase()}] [${this.module}] ${message}`;
        
        console.log(`${COLORS[level]}${stmt}${COLORS.reset}`);
        
        if (Logger.logToFile) {
            Logger.logStream.write(stmt + '\n');
        }
    }
    
    debug(...args) {
        this.log('debug', ...args);
    }

    info(...args) {
        this.log('info', ...args);
    }

    warn(...args) {
        this.log('warn', ...args);
    }

    error(...args) {
        this.log('error', ...args);
    }
}

function getLogger(module) {
    if (! Logger.logStream) {
        Logger.configure();
    }
    return new Logger(path.basename(module, '.js'));
}

module.exports = {
    getLogger
};
