// import nodejs bindings to native tensorflow,
// not required, but will speed up things drastically (python required)
require('@tensorflow/tfjs-node');

// implements nodejs wrappers for HTMLCanvasElement, HTMLImageElement, ImageData
const canvas = require('canvas');

const faceapi = require('face-api.js');
const fetch = require('node-fetch');
const path = require('path');
const { promisify } = require('util');
const fs = require('fs');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);

// patch nodejs environment, we need to provide an implementation of
// HTMLCanvasElement and HTMLImageElement, additionally an implementation
// of ImageData is required, in case you want to use the MTCNN
const { Canvas, Image, ImageData } = canvas
faceapi.env.monkeyPatch({ Canvas, Image, ImageData, fetch })

const MODELS_URL = path.resolve('./models');

// faceapi.nets.mtcnn.loadFromDisk(MODELS_URL);
faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_URL);

// Load the face landmark models
faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_URL);

// Load the face recognition models
faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_URL);

const Wait = (timeout) => new Promise((resolve) => {
  setTimeout(resolve, timeout);
})

const _cliProgress = require('cli-progress');

const bar1 = new _cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% || {value}/{total} || {user} - {index}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
}, _cliProgress.Presets.shades_classic);

const run = async () => {
  await Wait(1000);

  let cache = await readFile('./_cache.json', 'utf8');
  try {
    cache = JSON.parse(cache||'{}')
  } catch (e) {};

  let files = await readdir('./seed');
  bar1.start(files.length, 0)

  files = files.reduce((files, file)=>{
    const p = path.parse(file)
    let [username] = p.name.split('-');
    files[username] = files[username]||[];
    files[username].push(file);
    return files;
  }, {})

  for (const username in files) {
    let descriptors = [];
    for (const file of files[username]) {
      bar1.increment(1, {user: username, index: file})
      const image = await canvas.loadImage(`./seed/${file}`)

      if (!image) continue;
      descriptors.push(await faceapi.computeFaceDescriptor(image))
    }
    cache[username] = descriptors
  }
  bar1.stop();

  await writeFile('./_cache.json', JSON.stringify(cache), 'utf8')
}

run();
