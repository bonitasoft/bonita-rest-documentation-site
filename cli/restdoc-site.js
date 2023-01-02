#!/usr/bin/env node

"use strict";

const fs = require('fs');
const fse = require('fs-extra');
const path = require("path")
const https = require('follow-redirects').https;// or 'https' for https:// URLs
const unzipper = require("unzipper");
const Handlebars = require('handlebars');

const {hideBin} = require('yargs/helpers')

const sourceDirectory = './site';
const templatePath = `${sourceDirectory}/templates`
const staticFilePath = `${sourceDirectory}/files`
const vars = JSON.parse(fs.readFileSync(`${sourceDirectory}/vars.json`, {encoding: 'utf8'}).toString())

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


function generate_site_root(outputDirectory, siteUrl, latest) {

    logger.debug(`The site url is ${siteUrl}`);
    logger.debug(`Latest release is ${latest}`);

    // Add cli args to global template vars
    vars.siteUrl = siteUrl
    vars.latest = latest

    fse.ensureDirSync(outputDirectory);

    // Copy static files from "src/files" folder
    fse.copySync(staticFilePath, `${outputDirectory}/`);

    // Process handlerbars templates from "src/templates" folder
    const processTemplates = (templateDir) => {
        const readDirMain = fs.readdirSync(templateDir);
        readDirMain.forEach((templateFileName) => {
            const templateFilePath = `${templateDir}/${templateFileName}`

            if (fs.lstatSync(templateFilePath).isDirectory()) {
                // Directory, move on
                processTemplates(templateFilePath);
            } else if (templateFileName.endsWith('.hbs')) {
                // Process template
                const template = fs.readFileSync(templateFilePath, {encoding: 'utf8'}).toString()
                let render = Handlebars.compile(template);
                let result = render(vars)

                const resultFileName = templateFilePath.replace(templatePath, outputDirectory).replace(".hbs", "")
                fse.ensureDirSync(path.dirname(resultFileName));
                fs.writeFile(resultFileName, result, (err) => {
                    if (err) {
                        logger.error(`Failed to render template ${resultFileName}: ${err.message}`);
                    }
                });
            } else {
                logger.warn(`${templateFileName} is not a template file, ignoring it.`)
            }
        });
    };
    processTemplates(templatePath)
}

async function downloadRelease(outputDirectory, releaseVersion) {
    logger.debug(` - Release to deploy ${releaseVersion}`);
    try {
        let downloadUrl = vars.downloadUrlTemplate.replaceAll("${releaseVersion}", releaseVersion);
        logger.debug(`Release download Url ${downloadUrl}`);
        const httpRequest = doDownloadAndUnzipRelease(outputDirectory, downloadUrl, releaseVersion)
        await httpRequest
    } catch (err) {
        logger.error(`Failed to download Bonita OpenAPI release for version: ${releaseVersion}: ${err.message}`)
    }
}

function doDownloadAndUnzipRelease(outputDirectory, downloadUrl, releaseVersion) {
    return new Promise((resolve, reject) => {
        const zipPath = `${outputDirectory}/${releaseVersion}.zip`
        const output = fs.createWriteStream(zipPath);
        https.get(downloadUrl, (response) => {
            response.pipe(output);
            // after download completed close filestream
            output.on("finish", () => {
                output.close();
                logger.debug(`${releaseVersion} download Completed`);
                // Unzip release to target folder
                fs.createReadStream(zipPath)
                    .pipe(unzipper.Extract({path: `${outputDirectory}/${releaseVersion}`}))
                    .on('close', () => {
                        logger.info(`Release ${releaseVersion} unzip Completed`);
                        fs.unlinkSync(zipPath)
                        resolve()
                    })
                    .on('error', (err) => {
                        fs.unlinkSync(zipPath)
                        logger.error(`Failed to unzip release ${releaseVersion} - ${err.message}`);
                        logger.error(`Skip release ${releaseVersion}`);
                        reject(err)
                    });
            });
        });
    });
}

// ===============================
// ========== Main ===============
// ===============================

const cli = require('yargs/yargs')(hideBin(process.argv))
    .scriptName("restdoc-site")
    .strict()
    .strictOptions()
    .strictCommands()
    .usage('Usage: $0 <command> [options]')
    .example([
        ['$0 clean', 'Clean output dir'],
        ["$0 build -s http://localhost -lt 0.0.11 -r 0.0.10 0.0.11", "Build static documentation site to deploy for Bonita OpenAPI released version 0.0.11."],
        ["$0 preview -s http://localhost -r https://github.com/bonitasoft/bonita-openapi -b feat/remove-tenant", "Build static documentation site preview for branch \"feat/remove-tenant\" of Bonita OpenAPI project"]
    ])
    .option({
        "o": {
            alias: "outputDir",
            describe: "The path to output directory.",
            default: '../build',
            type: "string",
            nargs: 1,
        }
    })
    .command({
        command: "clean",
        desc: "clean output directory",
        builder: (yargs) => {
            return yargs.options({
                "o": {
                    alias: "outputDir",
                    describe: "The path to output directory to clean.",
                    default: './build',
                    type: "string",
                    nargs: 1,
                }
            })
        },
        handler: (argv) => {
            const outputDir = argv.outputDir;
            fs.exists(outputDir, () => {
                fs.rmSync(outputDir, { recursive: true, force: true });
            });
        }
    })
    .command({
        command: 'build',
        desc: 'Build static documentation site to deploy',
        builder: (yargs) => {
            return yargs.options({
                "s": {
                    alias: "siteUrl",
                    describe: "The url of the deployed site.",
                    default: 'https://bonita-api-doc.netlify.app',
                    type: "string",
                    nargs: 1,
                }, "l": {
                    alias: "latest",
                    describe: "The release to use as latest for redirection.",
                    type: "string",
                    nargs: 1,
                }, "r": {
                    alias: "releases",
                    describe: "The releases of Bonita OpenAPI documentation to deploy.",
                    demandOption: "The release versions are required.",
                    type: "array",
                }
            })
        },
        handler: async (argv) => {
            const {outputDir, siteUrl, latest, releases} = argv;

            let latestRelease = latest
            if (releases.length === 1) {
                latestRelease = releases[0]
            }
            if (!releases.includes(latestRelease)) {
                throw Error(`Latest release "${latestRelease}" is not listed in the releases to deploy !`)
            }

            logger.info('Building REST documentation site');
            generate_site_root(outputDir, siteUrl, latestRelease)
            for (const r of releases) {
                await downloadRelease(outputDir, r)
            }
            logger.info(`REST documentation generated in ${outputDir}`);
        }
    })
    .command({
        command: 'preview',
        desc: 'Build static documentation site preview for a branch of Bonita OpenAPI project',
        builder: (yargs) => {
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
        },
        handler: (argv) => {
        }
    })
    // .fail(false)
    .fail((msg, err, yargs) => {
        logger.error(`${err.message}\n\nHelp:\n`)
        yargs.showHelp()
        process.exit(1)
    });

const argv = cli.parse();
logger.info(`REST documentation generation done.`);
