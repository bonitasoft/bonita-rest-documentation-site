// build.js

"use strict";

const fs = require('fs');
const fse = require('fs-extra');
const path = require("path")
const https = require('follow-redirects').https;// or 'https' for https:// URLs
const unzipper = require("unzipper");
const Handlebars = require('handlebars');

const logger = require('../logger.js');

async function downloadRelease(downloadUrlTemplate, outputDirectory, releaseVersion) {
    logger.debug(` - Release to deploy ${releaseVersion}`);
    try {
        let downloadUrl = downloadUrlTemplate.replaceAll("${releaseVersion}", releaseVersion);
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

exports.command = 'build'
exports.desc = 'Build static documentation site to deploy'
exports.builder = (yargs) => {
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
        }, "ut": {
            alias: "downloadUrlTemplate",
            describe: "The template url to download a release of Bonita OpenAPI documentation. URL should contains '${releaseVersion}' to be replaced.",
            default: "https://github.com/bonitasoft/bonita-openapi/releases/download/${releaseVersion}/bonita-openapi-${releaseVersion}.zip",
            type: "string",
            nargs: 1
        },
    }).check(async (argv) => {
        const sourceDir = argv.sourceDir
        const sourceDirExists = await fse.pathExists(sourceDir)
        if (!sourceDirExists) {
            throw Error(`Source site directory "${sourceDir}" does not exists !`)
        } else {
            return true // tell Yargs that the arguments passed the check
        }
    }).check((argv) => {
        const releases = argv.releases
        if (releases.length === 1) {
            argv.latest = releases[0]
        }
        const latest = argv.latest
        if (!releases.includes(latest)) {
            throw Error(`Latest release "${latest}" is not listed in the releases to deploy !`)
        } else {
            return true // tell Yargs that the arguments passed the check
        }
    })
}

exports.handler = async (argv) => {
    const {sourceDir, outputDir, siteUrl, latest, releases, downloadUrlTemplate} = argv;

    logger.info('Building REST documentation site');

    logger.debug(`The site url is ${siteUrl}`);
    logger.debug(`Latest release is ${latest}`);

    fse.ensureDirSync(outputDir);

    // Copy static files from "src/files" folder
    const staticFilePath = `${sourceDir}/files`
    fse.copySync(staticFilePath, `${outputDir}/`);

    // Process handlerbars templates from "src/templates" folder
    const templatePath = `${sourceDir}/templates`
    const vars = JSON.parse(fs.readFileSync(`${templatePath}/vars.json`, {encoding: 'utf8'}).toString())

    // Add cli args to global template vars
    vars.siteUrl = siteUrl
    vars.latest = latest
    vars.releases = releases

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

                const resultFileName = templateFilePath.replace(templatePath, outputDir).replace(".hbs", "")
                fse.ensureDirSync(path.dirname(resultFileName));
                fs.writeFile(resultFileName, result, (err) => {
                    if (err) {
                        logger.error(`Failed to render template ${resultFileName}: ${err.message}`);
                    }
                });
            } else if (templateFileName !== 'vars.json') {
                logger.warn(`${templateFileName} is not a template file, ignoring it.`)
            }
        });
    };
    processTemplates(templatePath)

    for (const r of releases) {
        await downloadRelease(downloadUrlTemplate, outputDir, r)
    }
    logger.info(`REST documentation generated in ${outputDir}`);
}

