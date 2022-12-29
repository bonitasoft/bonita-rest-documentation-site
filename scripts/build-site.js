"use strict";

const fs = require('fs');
const fse = require('fs-extra');
const path = require("path")
const https = require('follow-redirects').https;// or 'https' for https:// URLs
const unzipper = require("unzipper");
const Handlebars = require('handlebars');

const outputDirectory = './build';
const sourceDirectory = './src';
const templatePath = `${sourceDirectory}/templates`
const vars = JSON.parse(fs.readFileSync(`${sourceDirectory}/vars.json`, {encoding: 'utf8'}).toString())


console.info('Generating REST documentation site ');
fse.ensureDirSync(outputDirectory);

function generate_site_root() {
    fse.ensureDir(outputDirectory)
    // Files
    fse.copySync(`${sourceDirectory}/files`, `${outputDirectory}/`);

    // Templates
    const processTemplates = (dirMain) => {
        const readDirMain = fs.readdirSync(dirMain);
        readDirMain.forEach((dirNext) => {

            // console.debug(dirMain + "/" + dirNext, fs.lstatSync(dirMain + "/" + dirNext).isDirectory());

            if (fs.lstatSync(dirMain + "/" + dirNext).isDirectory()) {
                // Directory, move on
                processTemplates(dirMain + "/" + dirNext);
            } else if (dirNext.endsWith('.hbs')) {
                // Process template
                const templateFilePath = dirMain + "/" + dirNext
                const templateFileName = dirNext
                const template = fs.readFileSync(templateFilePath, {encoding: 'utf8'}).toString()
                let render = Handlebars.compile(template);
                let result = render(vars)

                const resultFileName = templateFilePath.replace(templatePath, outputDirectory).replace(".hbs", "")
                fse.ensureDirSync(path.dirname(resultFileName));
                fs.writeFile(resultFileName, result, function (err) {
                    if (err) {
                        return console.log(err);
                    }
                });
            } else {
                // console.debug(`${dirNext} is not a template file, ignoring it.`)
            }
        });
    };
    processTemplates(templatePath)

}

function downloadRelease(releaseVersion) {
    const zipPath = `${outputDirectory}/${releaseVersion}.zip`
    const output = fs.createWriteStream(zipPath);
    https.get(`https://github.com/bonitasoft/bonita-openapi/releases/download/${releaseVersion}/bonita-openapi-${releaseVersion}.zip`,
        function (response) {
            response.pipe(output);
            // after download completed close filestream
            output.on("finish", () => {
                output.close();
                console.log(`${releaseVersion} download Completed`);

                fs.createReadStream(zipPath)
                    .pipe(unzipper.Extract({path: `${outputDirectory}/${releaseVersion}`}))
                    .on('close', () => {
                        fs.unlinkSync(zipPath)
                    });
            });
        });
}

generate_site_root()

downloadRelease('0.0.11')
