// logger.js

"use strict";

const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [
        // new winston.transports.File({
        //     filename: 'restdoc-site.log', level: 'info', format: winston.format.combine(
        //         winston.format.timestamp(),
        //         winston.format.logstash()
        //     )
        // }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
            )
        })
    ]
});

module.exports = logger
