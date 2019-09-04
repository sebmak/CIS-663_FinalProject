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

// patch nodejs environment, we need to provide an implementation of
// HTMLCanvasElement and HTMLImageElement, additionally an implementation
// of ImageData is required, in case you want to use the MTCNN
const { Canvas, Image, ImageData } = canvas
faceapi.env.monkeyPatch({ Canvas, Image, ImageData, fetch })

// const OPTIONS = faceapi.MtcnnOptions;
const OPTIONS = faceapi.TinyFaceDetectorOptions;

const MODELS_URL = path.resolve('./models');
// faceapi.nets.mtcnn.loadFromDisk(MODELS_URL);
faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_URL);

// Load the face landmark models
faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_URL);

// Load the face recognition models
faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_URL);


const user_data = {};

let _model = null

const queue = new Set();

let is_training = false;

const initializeModel = async () => {
  const data = JSON.parse(await readFile('./_cache.json'), 'utf8');

  let count = 0;
  for (const username in data) {
    count++;
    user_data[username] = new faceapi.LabeledFaceDescriptors(
      username,
      data[username].map(v=>new Float32Array(Object.values(v)))
    );
  }

  _model = new faceapi.FaceMatcher(Object.values(user_data))
  console.log(`Model loaded from cache with ${count} users`);
}

initializeModel();

const GetDescriptors = async (item) => {
  queue.delete(item);
  let { username, imagesForTraining=1 } = item;
  const maxImagesForTraining = 8;
  imagesForTraining = Math.min(imagesForTraining, maxImagesForTraining)

  console.log(`Generating Descriptors for: ${username}`)
  let descriptors = [];
  for (let i = 0; i <= imagesForTraining; i++) {
    let url = path.resolve(`./out/${username}-${i}.jpg`)
    console.log(`Grabbing: ${url}`)
    const image = await canvas.loadImage(url)

    if (!image) continue;
    descriptors.push(await faceapi.computeFaceDescriptor(image))
  }

  user_data[username] = new faceapi.LabeledFaceDescriptors(
    username,
    descriptors
  )
}

const writeDescriptorCache = async (data) => {
  console.log("Writing Cache");
  let out = {};
  for (const username in data) {
    out[username] = data[username].descriptors
  }

  await writeFile('./_cache.json', JSON.stringify(out), 'utf8')
}

const doTrain = async () => {
  is_training = true;

  try {
    for (const item of [...queue]) {
      await GetDescriptors(item)
      queue.delete(item)
    }

    await writeDescriptorCache(user_data)

    console.log(`Training Model`)
    _model = new faceapi.FaceMatcher(Object.values(user_data))
    console.log(`-- Done`)
  } catch (e) {
    console.error(e);
  }

  if(!is_training) {
    doTrain()
  } else {
    is_training = false;
  }
}

module.exports.train = async (username, imagesForTraining=1) => {
  queue.add({
    username: username,
    imagesForTraining: imagesForTraining
  })

  if(!is_training) {
    await doTrain()
  }
}

const GetImage = (data) => new Promise((resolve, reject) => {

  const img = new Image();

  img.onload = () => {
    resolve(img);
  }

  img.onerror = (e) => {
    reject(e)
  }

  img.src = data;
})

module.exports.match = async (data) => {
  try {
    const img = await GetImage(`data:image/jpg;base64,${data}`);

    const results = await faceapi
      .detectAllFaces(img, new OPTIONS(224,0.5))
      .withFaceLandmarks()
      .withFaceDescriptors()

    const matches = results.map((r) => {
      return (
        _model.findBestMatch(r.descriptor)
      )
    });

    return matches;

  } catch (e) {
    console.error(e);
  }

  return []
}

module.exports.model = _model;
