import React, { Fragment } from 'react';
import styled from 'styled-components';
import { withRouter } from 'react-router-dom';
import bcrypt from 'bcryptjs';
import StreamContext from 'stream-context';
import { API, OPTIONS } from 'options';

import {ReactComponent as N} from 'n.svg';
import {ReactComponent as NE} from 'ne.svg';
import {ReactComponent as E} from 'e.svg';
import {ReactComponent as SE} from 'se.svg';
import {ReactComponent as S} from 's.svg';
import {ReactComponent as SW} from 'sw.svg';
import {ReactComponent as W} from 'w.svg';
import {ReactComponent as NW} from 'nw.svg';
import {ReactComponent as C} from 'c.svg';

const ZoneWrapper = styled.div`
  position: absolute;
  top: ${props=>props.top};
  left: ${props=>props.left};
  transform: translate(${props=>props.left==='50%' ? '-50%' : props.left==='100%' ? '-100%' : '0'}, ${props=>props.top==='50%' ? '-50%' : props.top==='100%' ? '-100%' : '0'});
`;

const NZone = () => (
  <ZoneWrapper top={'0%'} left={'50%'}>
    <N />
  </ZoneWrapper>
)
const NEZone = () => (
  <ZoneWrapper top={'0%'} left={'100%'}>
    <NE />
  </ZoneWrapper>
)
const EZone = () => (
  <ZoneWrapper top={'50%'} left={'100%'}>
    <E />
  </ZoneWrapper>
)
const SEZone = () => (
  <ZoneWrapper top={'100%'} left={'100%'}>
    <SE />
  </ZoneWrapper>
)
const SZone = () => (
  <ZoneWrapper top={'100%'} left={'50%'}>
    <S />
  </ZoneWrapper>
)
const SWZone = () => (
  <ZoneWrapper top={'100%'} left={'0%'}>
    <SW />
  </ZoneWrapper>
)
const WZone = () => (
  <ZoneWrapper top={'50%'} left={'0%'}>
    <W />
  </ZoneWrapper>
)
const NWZone = () => (
  <ZoneWrapper top={'0%'} left={'0%'}>
    <NW />
  </ZoneWrapper>
)
const CZone = () => (
  <ZoneWrapper top={'50%'} left={'50%'}>
    <C />
  </ZoneWrapper>
)

const Wrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
`;

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
`;
const Video = styled.video`
  position: absolute;
  width: 100vw;
  height: 100vh;
  background-color: #000;
`;
const Button = styled.button`
  font-size: 2em;
`;

const Countdown = styled.h1`
  font-size: 4em;
  color: #fff;
`;


function isFaceDetectionModelLoaded() {
  return !!API.params
}

const Wait = (timeout) => new Promise((resolve) => {
  setTimeout(resolve, timeout);
})

class LookZones extends React.Component {
  state = {
    Render: ()=>null,
    inputSize: 224,
    scoreThreshold: 0.75,
  }

  componentDidMount() {
    this.countdown();
  }

  countdown = async () => {
    for (let i = 0; i < 3; i++) {
      this.setState({
        Render: () => (
          <Countdown>{3-i}</Countdown>
        )
      })
      await Wait(1000);
    }

    await this.capture();
  }

  capture = async () => {
    const Zones = [
      NZone,NEZone,EZone,SEZone,SZone,SWZone,WZone,NWZone,CZone
    ]
    for (let i = 0; i < Zones.length; i++) {
      const Zone = Zones[i]
      this.setState({
        Render: Zone
      })
      await Wait(1000);
      await this.props.capture(i);
    }

    this.props.onComplete();
  }

  render() {
    const {
      Render
    } = this.state;
    return <Render />;
  }
}

class LookAndCapture extends React.Component {
  state = {
    started: false,
    username: ''
  }

  constructor(...params) {
    super(...params);
    this.videoRef = React.createRef();
    this.canvasRef = React.createRef();
  }

  startVideo = async () => {
    try {
      if (this.videoRef.current) {
        if (this.videoRef.current.srcObject !== this.context.stream) {
          this.videoRef.current.srcObject = this.context.stream
          this.videoRef.current.play()
        }
      } else {
        window.requestAnimationFrame(this.startVideo)
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

  }

  componentDidMount() {
    this.setState({
      username: prompt("Username")
    })
    this.connect();
    this.startVideo();
  }

  start = () => {
    document.documentElement.requestFullscreen();
    this.setState({
      started: true
    })
  }

  get options() {
    return new OPTIONS({
      inputSize: this.state.inputSize,
      scoreThreshold: this.state.scoreThreshold
    })
  }

  capture = async (index) => {
    const result = await window.faceapi.detectSingleFace(this.videoRef.current, this.options).withFaceLandmarks()

    if (!result) {
      setTimeout(()=>this.capture(index), 10);
      return
    }
    this.getImage(result, index);
  }


  getImage = (result, index) => {
    if (!result) return;

    const box = result.alignedRect.box;
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
      path: '/train',
      index: index,
      features: result,
      username: this.state.username,
      data: canvas.toDataURL('image/jpeg', 0.5).replace(/^data:image\/jpeg;base64,/, "")
    }))
  }

  handleComplete = () => {
    const password = bcrypt.hashSync(prompt('password'), 10);

    this.connection.send(JSON.stringify({
      path: '/register',
      username: this.state.username,
      password: password
    }));

    this.props.history.push('/');
  }

  render() {
    return (
      <Fragment>
        <Video ref={this.videoRef} autoplay muted playsinline></Video>
        <Canvas ref={this.canvasRef} />
        <Wrapper>
          {
            this.state.started
              ? <LookZones capture={this.capture} onComplete={this.handleComplete} />
              : <Button onClick={this.start}>Start</Button>
          }
        </Wrapper>
      </Fragment>
    );
  }
}

LookAndCapture.contextType = StreamContext;

export default withRouter(LookAndCapture)
