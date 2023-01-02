// preview.js

"use strict";

exports.command = 'preview'
exports.desc = 'Build static documentation site preview for a branch of Bonita OpenAPI project'
exports.builder = (yargs) => {
    return yargs.options({
        "r": {
            alias: "repositoryUrl",
            describe: "The url of the Bonita OpenAPI project repository.",
            default: 'https://github.com/bonitasoft/bonita-openapi',
            type: "string",
            nargs: 1,
        }, "b": {
            alias: "branch",
            describe: "The branch for which to generate preview.",
            demandOption: "The branch name to preview is required.",
            type: "string",
            nargs: 1,
        }
    })
}
exports.handler = (argv) => {
}
