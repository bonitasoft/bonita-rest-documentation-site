#!/usr/bin/env node

"use strict";

const {hideBin} = require('yargs/helpers')
const logger = require('./logger.js');

require('yargs/yargs')(hideBin(process.argv))
    .scriptName("restdoc-site")
    .strictOptions(false)
    .usage('Usage: $0 <command> [options]')
    .example([
        ['$0 clean', 'Clean output dir'],
        ["$0 build -s http://localhost -l 0.0.11 -r 0.0.10 0.0.11", "Build static documentation site to deploy for Bonita OpenAPI released version 0.0.11."],
        ["$0 preview -s http://localhost -r https://github.com/bonitasoft/bonita-openapi -b feat/remove-tenant", "Build static documentation site preview for branch \"feat/remove-tenant\" of Bonita OpenAPI project"]
    ])
    .config()
    .option({
            "d": {
                alias: "sourceDir",
                describe: "The path to source directory.",
                default: './src',
                type: "string",
                nargs: 1,
            }
        })
    .option({
            "o": {
                alias: "outputDir",
                describe: "The path to output directory.",
                default: './build',
                type: "string",
                nargs: 1,
            }
        })
    .commandDir('commands')
    .fail((msg, err, yargs) => {
        const errMessage = err ? err.message : 'Error !'
        logger.error(`${msg ? msg : errMessage}\n\nHelp:\n`)
        yargs.showHelp()
        process.exit(1)
    }).parse();
