// build.js

"use strict";

const fs = require('fs');
const fse = require('fs-extra');
const path = require("path")
const https = require('follow-redirects').https;// or 'https' for https:// URLs
const unzipper = require("unzipper");
const Handlebars = require('handlebars');
const exec = require('child_process').exec;

const livereload = require('livereload');
const connect = require('connect');
const serverStatic = require('serve-static');
const hound = require('hound')


const logger = require('../logger.js');

const LATEST_FOLDER = 'latest';

async function downloadRelease(downloadUrlTemplate, outputDirectory, releaseVersion, latest) {
    logger.debug(` - Release to deploy ${releaseVersion}`);
    try {
        let downloadUrl = downloadUrlTemplate.replaceAll("${releaseVersion}", releaseVersion);
        logger.debug(`Release download Url ${downloadUrl}`);
        const httpRequest = doDownloadAndUnzipRelease(outputDirectory, downloadUrl, releaseVersion, latest)
        await httpRequest
    } catch (err) {
        logger.error(`Failed to download Bonita OpenAPI release for version: ${releaseVersion}: ${err.message}`)
    }
}

function doDownloadAndUnzipRelease(outputDirectory, downloadUrl, releaseVersion, latest) {
    return new Promise((resolve, reject) => {
        const zipPath = `${outputDirectory}/${releaseVersion}.zip`
        const output = fs.createWriteStream(zipPath);

        function getOutputExtractFolderName() {
            if (releaseVersion === latest) {
                logger.info(`Release ${releaseVersion} will be extracted in '${LATEST_FOLDER}' folder`);
                return unzipper.Extract({path: `${outputDirectory}/${LATEST_FOLDER}`});
            }
            return unzipper.Extract({path: `${outputDirectory}/${releaseVersion}`});
        }

        https.get(downloadUrl, (response) => {
            response.pipe(output);
            // after download completed close filestream
            output.on("finish", () => {
                output.close();
                logger.debug(`${releaseVersion} download Completed`);
                // Unzip release to target folder
                fs.createReadStream(zipPath)
                    .pipe(getOutputExtractFolderName())
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
            default: 'https://api-documentation.bonitasoft.com',
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
        }, "w": {
            alias: "watch",
            describe: "Start a server for preview and watch for any file changes. Hot reload the server if any changes.",
            default: "false",
            type: "boolean",
            nargs: 1
        }, "p": {
            alias: "port",
            describe: "The preview server port used to browse the site.",
            default: 8000,
            type: "number",
            nargs: 1
        }, "lrp": {
            alias: "liveReloadPort",
            describe: "The live reload server port (only use by browser to check for reloads).",
            default: 35729,
            type: "number",
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

async function replaceProductionSiteTemplate(siteUrl, ga_key) {

    exec(`sed -i "s/\\$SITE_URL/${siteUrl.replaceAll('/', '\\/')}/" build/**/*.html && sed -i "s/\\$GA_KEY/${ga_key}/" build/**/*.html`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            logger.error(`stderr: ${stderr}`);
            return;
        }
    });
    logger.debug('Processed successfully `vars` in index.html files');
}

function processSources(sourceDir, outputDir, siteUrl, latest, releases, watch, port,liveReloadPort) {
    // Copy static files from "src/files" folder
    const staticFilePath = `${sourceDir}/files`
    fse.copySync(staticFilePath, `${outputDir}/`);

    // Process handlerbars templates from "src/templates" folder
    const templatePath = `${sourceDir}/templates`
    const vars = JSON.parse(fs.readFileSync(`${templatePath}/vars.json`, {encoding: 'utf8'}).toString())

    // Add cli args to global template vars
    vars.siteUrl = siteUrl;
    vars.latest = latest;
    vars.releases = releases;
    vars.watch = watch;
    vars.port = port;
    vars.liveReloadPort = liveReloadPort;

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
    return vars;
}

exports.handler = async (argv) => {
    logger.info('Building REST documentation site');

    const {
        sourceDir,
        outputDir,
        latest,
        releases,
        downloadUrlTemplate,
        watch,
        port,
        liveReloadPort
    } = argv;

    // If dev mode is enabled, use localhost url instead of real site url
    let siteUrl = watch ? `http://localhost:${port}` : argv.siteUrl

    logger.debug(`The site url is ${siteUrl}`);
    logger.debug(`Latest release is ${latest}`);

    fse.ensureDirSync(outputDir);

    // First rendering ot the site
    const vars = processSources(sourceDir, outputDir, siteUrl, latest, releases, watch, port,liveReloadPort);

    // Process releases to publish
    for (const r of releases) {
        await downloadRelease(downloadUrlTemplate, outputDir, r, latest)
    }
    await replaceProductionSiteTemplate(siteUrl, vars.ga_key || '');

    logger.info(`REST documentation generated in ${outputDir}`);

    // If dev mode is enabled, reprocess file from source directory on changes and trigger browser reload
    if (watch) {

        // Serve static site from output directory
        var app = connect();
        app.use(serverStatic(outputDir, {
            dotfiles: 'ignore'
        }));
        // simulate 'latest' redirection
        app.use(`/${latest}`, (req, res) => {
            // req.url starts with the latest version so redirect to the "latest" folder
            res.writeHead(307, {Location: "/latest/"});
            res.end();
        });
        // error middleware for errors that occurred in middleware declared before this
        app.use(function onerror(err, req, res, next) {
            logger.error('err: '+ err)
            // logger.error(JSON.stringify(res))
            next();
        });

        // Since this is the last non-error-handling
        // middleware use()d, we assume 404, as nothing else
        // responded.
        app.use(function(req, res, next) {
            res.writeHead(307, {Location: "/404.html"});
            res.end();
        });
        app.listen(port);

        // Watch source directory and trigger rebuild
        logger.info(`Watching files in ${sourceDir}`);
        const watcher = hound.watch(sourceDir)
        // Add callbacks for file and directory events.
        // The change event only applies to files.
        watcher.on('create', function (file, stats) {
            if (!file.endsWith('~')) {
                console.log(file + ' was created')
                processSources(sourceDir, outputDir, siteUrl, latest, releases, watch, port);
            }
        })
        watcher.on('change', function (file, stats) {
            if (!file.endsWith('~')) {
                console.log(file + ' was changed')
                processSources(sourceDir, outputDir, siteUrl, latest, releases, watch, port);
            }
        })
        watcher.on('delete', function (file) {
            if (!file.endsWith('~')) {
                console.log(file + ' was deleted')
                processSources(sourceDir, outputDir, siteUrl, latest, releases, watch, port);
            }
        })

        // livereloadServer trigger browser reload on site output changes
        var livereloadServer = livereload.createServer({
            port: liveReloadPort,
            extraExts: ['html', 'css', 'js', 'json', 'png', 'gif', 'jpg', 'svg', 'hbs']
        }, () => logger.info(`Dev server is ready at http://localhost:${port}`));
        livereloadServer.watch(outputDir);
    }
}

