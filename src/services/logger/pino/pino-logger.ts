import pino, { LoggerOptions } from 'pino'
import { LOG_LEVEL, DeepstreamPlugin, DeepstreamLogger, DeepstreamConfig, DeepstreamServices, NamespacedLogger, EVENT } from '@deepstream/types'

const DSToPino: { [index: number]: pino.LevelWithSilent } = {
    [LOG_LEVEL.DEBUG]: 'debug',
    [LOG_LEVEL.FATAL]: 'fatal',
    [LOG_LEVEL.ERROR]: 'error',
    [LOG_LEVEL.WARN]: 'warn',
    [LOG_LEVEL.INFO]: 'info',
    [LOG_LEVEL.OFF]: 'silent',
}

export class PinoLogger extends DeepstreamPlugin implements DeepstreamLogger {
    public description = 'Pino Logger'
    private logger: pino.Logger

    constructor (pluginOptions: LoggerOptions, private services: DeepstreamServices, config: DeepstreamConfig) {
        super()
        this.logger = pino(pluginOptions)
        this.setLogLevel(config.logLevel)
    }

    /**
     * Return true if logging is enabled. This is used in deepstream to stop generating useless complex strings
     * that we know will never be logged.
     */
    public shouldLog (logLevel: LOG_LEVEL): boolean {
        return this.logger.isLevelEnabled(DSToPino[logLevel])
    }

    /**
     * Set the log level desired by deepstream. Since deepstream uses LOG_LEVEL this needs to be mapped
     * to whatever your libary uses (this is usually just conversion stored in a static map)
     */
    public setLogLevel (logLevel: LOG_LEVEL): void {
        this.logger.level = DSToPino[logLevel]
    }

    /**
     * Log as info
     */
    public info (event: EVENT, message?: string, metaData?: any): void {
        if (metaData) {
            this.logger.info({ event, message, ...metaData })
        } else {
            this.logger.info({ event, message })
        }
    }

    /**
     * Log as debug
     */
    public debug (event: EVENT, message?: string, metaData?: any): void {
        if (metaData) {
            this.logger.debug({ event, message, ...metaData })
        } else {
            this.logger.debug({ event, message })
        }
    }

    /**
     * Log as warn
     */
    public warn (event: EVENT, message?: string, metaData?: any): void {
        if (metaData) {
            this.logger.warn({ event, message, ...metaData })
        } else {
            this.logger.warn({ event, message })
        }
    }

    /**
     * Log as error
     */
    public error (event: EVENT, message?: string, metaData?: any): void {
        this.services.monitoring.onErrorLog(LOG_LEVEL.ERROR, event, message!, metaData!)
        if (metaData) {
            this.logger.error({ event, message, ...metaData })
        } else {
            this.logger.error({ event, message })
        }
    }

    /**
     * Log as fatal
     */
    public fatal (event: EVENT, message?: string, metaData?: any): void {
        this.services.monitoring.onErrorLog(LOG_LEVEL.FATAL, event, message!, metaData!)
        if (metaData) {
            this.logger.fatal({ event, message, ...metaData })
        } else {
            this.logger.fatal({ event, message })
        }
        this.services.notifyFatalException()
    }

    /**
     * Create a namespaced logger, used by plugins. This could either be a new instance of a logger
     * or just a thin wrapper to add the namespace at the beginning of the log method.
     */
    public getNameSpace (namespace: string): NamespacedLogger {
        return {
          shouldLog: this.shouldLog.bind(this),
          fatal: this.log.bind(this, DSToPino[LOG_LEVEL.FATAL], namespace),
          error: this.log.bind(this, DSToPino[LOG_LEVEL.ERROR], namespace),
          warn: this.log.bind(this, DSToPino[LOG_LEVEL.WARN], namespace),
          info: this.log.bind(this, DSToPino[LOG_LEVEL.INFO], namespace),
          debug: this.log.bind(this, DSToPino[LOG_LEVEL.DEBUG], namespace),
        }
    }

    private log (logLevel: pino.LevelWithSilent, namespace: string, event: EVENT, message: string, metaData?: any ) {
        this.logger[logLevel]({ namespace, event, message, ...metaData })
    }
}
