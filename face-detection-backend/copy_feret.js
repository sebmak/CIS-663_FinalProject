const fs = require('fs');
const { promisify } = require('util');
var glob = require('glob-fs')({ gitignore: true });
const faker = require('faker');
const path = require('path');
const exec = require('child_process').exec;

const _cliProgress = require('cli-progress');


const copyFile = promisify(fs.copyFile);

const users = {}
const bar1 = new _cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% || {value}/{total} || {from} to {to}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
}, _cliProgress.Presets.shades_classic);

const do_exec = (cmd) => new Promise((resolve, reject) => {
  exec(cmd, function(error, stdout, stderr) {
    if (error) {
      return reject(err);
    }
    return resolve(stdout);
  });
})

const run = async () => {
  const files = (await glob.readdirPromise('./colorferet/**/data/images/*/*.ppm')).filter(f=>f.slice(-3)==='ppm');

  bar1.start(files.length, 0)
  for (const file of files) {
    const p = path.parse(file);
    const [user] = p.name.split('_')
    users[user] = users[user]||{name:faker.internet.userName().toLowerCase(),index:0}
    const newFile = path.resolve(`./seed/${users[user].name}-${users[user].index}.jpg`)
    users[user].index++;

    bar1.increment(1, {from: path.relative(__dirname, file) ,to: path.relative(__dirname, newFile)})

    await do_exec(`convert ${path.relative(__dirname, file)} ${path.relative(__dirname, newFile)}`)
  }
  bar1.stop();
}

run().then(()=>console.log("Done")).catch(e=>console.error(e));
