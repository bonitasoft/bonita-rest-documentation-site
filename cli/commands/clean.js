// clean.js

"use strict";

const fs = require('fs');

exports.command = "clean"
exports.desc = "clean output directory"
exports.builder = (yargs) => {
    return yargs.options({
        "o": {
            alias: "outputDir",
            describe: "The path to output directory to clean.",
            default: './build',
            type: "string",
            nargs: 1,
        }
    })
}
exports.handler = (argv) => {
    const outputDir = argv.outputDir;
    fs.exists(outputDir, () => {
        fs.rmSync(outputDir, {recursive: true, force: true});
    });
}
