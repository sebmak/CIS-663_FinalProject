import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import StreamContext from 'stream-context';
import styled from 'styled-components';

import { API, OPTIONS } from 'options';
const Wait = (timeout) => new Promise((resolve) => {
  setTimeout(resolve, timeout);
})

const FPS = styled.div`
  position: fixed;
  bottom: 0;
  right: 0;
  background: green;
  color: black;
  padding: .5em;
  z-index: 100000;
`;

const Canvas = styled.canvas`
  background: rgba(0,0,0,.5);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const VideoWrapper = styled.div`
  position: absolute;
  z-index: 1;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
`;

const SigninModal = styled.div`
  background: #fff;
  padding: .5em;
  border-radius: .25em;
  position: relative;
  margin: 2em;
  z-index: 100;
`;
const SigninPage = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: #000;
`;

const Input = styled.input`
  display: block;
  font-size: 1.5em;
  border-radius: .25em;
  border: 1px solid rgb(204, 204, 204);
  margin-bottom: 1em;
  margin-top: .25em;
`;

const Button = styled.button`
  padding: .5em 1em;
  border: none;
  font-size: 1em;
  margin-left: .5em;
  cursor: pointer;
  &:hover {
    backgroun: #ccc;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;


class Signin extends React.Component {
  state = {
    username: '',
    match: 0,
    debug: false,
    average: 0,
    mps: 0
  }

  forwardTimes = []
  match_times = []

  updateTimeStats = (timeInMs, score=0) => {
    this.forwardTimes = [timeInMs].concat(this.forwardTimes).slice(0, 30)
    this.match_times.push({score:score,time:timeInMs})
    const avgTimeInMs = this.forwardTimes.reduce((total, t) => total + t) / this.forwardTimes.length
    this.setState({
      average: Math.round(avgTimeInMs),
      mps: window.faceapi.round(1000 / avgTimeInMs)
    });
    if (this.match_times.length % 20 === 0) {
      console.log(this.match_times.length, this.match_times)
    }
  }

  constructor(...params) {
    super(...params);
    this.videoRef = React.createRef();
    this.canvasRef = React.createRef();

    this.state.debug = (new URLSearchParams(window.location.search)).has('debug')
  }


  startVideo = async () => {
    try {
      if (this.videoRef.current) {
        if (this.videoRef.current.srcObject !== this.context.stream) {
          this.videoRef.current.srcObject = this.context.stream
          this.videoRef.current.play()
        }
        this.getUsername();
      } else {
        window.requestAnimationFrame(this.startVideo)
      }

    } catch (e) {
      console.error(e);
    }
  }

  last_message = 0

  getUsernameFromImage = async (result) => {
    if (!result) return;

    const box = result.box;
    const canvas = document.createElement('canvas');
    canvas.width = box.width;
    canvas.height = box.height;
    const context = canvas.getContext("2d");
    const source = this.videoRef.current

    context.drawImage(
      source,
      box.left - 50,
      box.top - 50,
      box.width + 100,
      box.height + 100,
      0,
      0,
      box.width,
      box.height
    );
    context.restore();

    // const imageData = context.getImageData(0,0,box.width,box.height);
    // console.log(imageData);

    this.connection.send(JSON.stringify({
      path: '/match',
      data: canvas.toDataURL('image/jpeg', 0.5).replace(/^data:image\/jpeg;base64,/, "")
    }))

    const now = performance.now();
    while (this.last_message <= now) {
      await Wait(10);
    }
  }

  get options() {
    return new OPTIONS({
      inputSize: 224,
      scoreThreshold: 0.5
    })
  }

  getUsername = async () => {
    if (this.videoRef.current && this.videoRef.current.playing) {
      try {
        const ts = performance.now()
        const result = await window.faceapi.detectSingleFace(this.videoRef.current, this.options)
        this.updateTimeStats(performance.now() - ts, result.score)

        this.canvasRef.current.getContext('2d').clear(1);

        if(result && this.state.debug) {

          const dims = window.faceapi.matchDimensions(this.canvasRef.current, this.videoRef.current, true)
          const resizedResult = window.faceapi.resizeResults(result, dims)
          window.faceapi.draw.drawDetections(this.canvasRef.current, window.faceapi.resizeResults(resizedResult, dims))
          // window.faceapi.draw.drawFaceLandmarks(this.canvasRef.current, resizedResult)

        }

        await this.getUsernameFromImage(result)
      } catch (e) {
        console.error(e);
      }
    }
    setTimeout(this.getUsername, 10);
  }

  handleMatchMessage = (data) => {
    this.last_message = performance.now();

    let best_match = 0;
    let best_username = '';
    for (const result of data.data) {
      if ((result._distance > best_match || result._distance > 0.85) && result._label !== 'unknown') {
        best_match = result._distance;
        best_username = result._label;
      }
    }
    if (this.state.match < best_match) {
      this.setState({
        username: best_username,
        match: best_match
      })
    }
  }

  handleAuthAttempt = ({ success=false, error='' }) => {
    if (success) {
      alert("Successfully Signed In");
    } else {
      alert(error)
    }
  }

  handleMessage = ({ data }) => {
    try {
      data = JSON.parse(data);
      switch (data.path) {
        case '/match':
          this.handleMatchMessage(data)
          break;
        case '/auth-attempt':
          this.handleAuthAttempt(data)
          break;
        default:
          console.log("No Match")
      }

    } catch (e) {
      console.error(e);
    }
  }
  connect = () => {
    this.connection = new WebSocket(`ws://${window.location.hostname}:1337`);

    this.connection.addEventListener('open', (event) => {
      console.log("Connected")
    });
    this.connection.addEventListener('error', (event) => {
      console.error(event)
    });
    this.connection.addEventListener('close', (event) => {
      console.log("Disconnected")
      this.connect();
    });
    // Listen for messages
    this.connection.addEventListener('message', this.handleMessage);

  }
  handleSubmit = (e) => {
    e.preventDefault();
    if (this.state.username==='' || this.state.password==='') return;


    this.connection.send(JSON.stringify({
      path: '/auth-attempt',
      username: this.state.username,
      password: this.state.password
    }))
  }

  handleChange = (e) => {
    this.setState({
      [e.target.name]: e.target.value
    });
  }

  componentDidMount() {
    this.connect();
    this.startVideo();
  }

  render() {
    return (
      <SigninPage>
        <VideoWrapper>
          <Video ref={this.videoRef} />
          <Canvas ref={this.canvasRef} />
        </VideoWrapper>
        <SigninModal>
          <form onSubmit={this.handleSubmit}>
            {
              this.state.debug
                ? (
                  <Fragment>
                    <label>{this.state.username||'...Searching...'}</label><br />
                  </Fragment>
                )
                : (this.state.username?null:'searching')
            }
            <label>
              Enter Password
              <Input name='password' value={this.state.password} onChange={this.handleChange} type="password" />
            </label>
            <ButtonRow>
              <Link to="/register">Register</Link>
              <Button disabled={this.state.username==='' || this.state.password===''}>Signin</Button>
            </ButtonRow>
          </form>
        </SigninModal>
        {
          this.state.debug
            ? (
              <FPS>
                {this.state.average} MS/Match | {this.state.mps} Match/S
              </FPS>
            )
            : null
        }
      </SigninPage>
    )
  }
}

Signin.contextType = StreamContext;

export default Signin;
